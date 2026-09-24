import 'dotenv/config';
import bcrypt from 'bcrypt';
import { AppDataSource } from './config/data-source.js';
import { Category } from './entities/category.entity.js';
import { Event } from './entities/event.entity.js';
import { Favorite } from './entities/favorite.entity.js';
import { Notification } from './entities/notification.entity.js';
import { Organizer } from './entities/organizer.entity.js';
import { TicketType } from './entities/ticket-type.entity.js';
import { User } from './entities/user.entity.js';
import { Venue } from './entities/venue.entity.js';
import type { NotificationChannel, NotificationType } from '@eventia/shared';
import {
  DEMO_USERS,
  SEED_CATEGORIES,
  SEED_EVENTS,
  SEED_FAVORITES,
  SEED_ORGANIZERS,
  SEED_VENUES,
  type SeedEvent,
} from './seed-data.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const BCRYPT_COST = 12;
const created: Record<string, number> = {};

async function cleanupTestFixtures(): Promise<void> {
  await AppDataSource.transaction(async (em) => {
    await em.query(`DELETE FROM orders`);
    await em.query(`DELETE FROM cart_items`);
    await em.query(`DELETE FROM events WHERE name LIKE 'E2E %' OR name = 'Summer Symphony Nights'`);
    await em.query(`DELETE FROM venues WHERE name LIKE 'E2E %'`);
    await em.query(`DELETE FROM organizers WHERE slug = 'harmony-events-2' OR name LIKE 'E2E %'`);
    await em.query(`DELETE FROM categories WHERE name LIKE 'E2E %'`);
  });
  console.log('[seed] removed test fixtures (E2E *, harmony-events-2, Summer Symphony Nights)');
}

async function seedUsers(): Promise<void> {
  const repo = AppDataSource.getRepository(User);
  for (const u of DEMO_USERS) {
    const existing = await repo.findOneBy({ email: u.email });
    if (existing) continue;
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_COST);
    await repo.save(repo.create({ ...u, phone: null, preferredCity: null, profileImageUrl: null, passwordHash }));
    created.users = (created.users ?? 0) + 1;
  }
}

async function seedCategories(): Promise<Map<string, Category>> {
  const repo = AppDataSource.getRepository(Category);
  const bySlug = new Map<string, Category>();
  for (const c of SEED_CATEGORIES) {
    let cat = await repo.findOneBy({ slug: c.slug });
    if (!cat) {
      cat = await repo.save(repo.create(c));
      created.categories = (created.categories ?? 0) + 1;
    }
    bySlug.set(c.slug, cat);
  }
  return bySlug;
}

async function seedOrganizers(): Promise<Map<string, Organizer>> {
  const repo = AppDataSource.getRepository(Organizer);
  const bySlug = new Map<string, Organizer>();
  for (const o of SEED_ORGANIZERS) {
    let org = await repo.findOneBy({ slug: o.slug });
    if (!org) {
      org = await repo.save(repo.create(o));
      created.organizers = (created.organizers ?? 0) + 1;
    }
    bySlug.set(o.slug, org);
  }
  return bySlug;
}

async function seedVenues(): Promise<Map<string, Venue>> {
  const repo = AppDataSource.getRepository(Venue);
  const byName = new Map<string, Venue>();
  for (const v of SEED_VENUES) {
    let venue = await repo.findOneBy({ name: v.name });
    if (!venue) {
      venue = await repo.save(repo.create(v));
      created.venues = (created.venues ?? 0) + 1;
    }
    byName.set(v.name, venue);
  }
  return byName;
}

const toDate = (inDays: number): Date => new Date(Date.now() + inDays * DAY_MS);

async function seedEvent(
  ev: SeedEvent,
  categories: Map<string, Category>,
  organizers: Map<string, Organizer>,
  venues: Map<string, Venue>,
): Promise<void> {
  const repo = AppDataSource.getRepository(Event);
  const existing = await repo.findOneBy({ name: ev.name });
  if (existing) return;

  const category = categories.get(ev.categorySlug)!;
  const organizer = organizers.get(ev.organizerSlug)!;
  const venue = venues.get(ev.venueName)!;

  const event = await repo.save(
    repo.create({
      name: ev.name,
      description: ev.description ?? null,
      categoryId: category.id,
      organizerId: organizer.id,
      venueId: venue.id,
      dateTime: toDate(ev.inDays),
      city: ev.city ?? venue.city,
      address: ev.address ?? venue.address,
      maxCapacity: ev.maxCapacity ?? null,
      ageRestriction: ev.ageRestriction ?? null,
      accessibilityInfo: null,
      featured: ev.featured ?? false,
      imageUrl: ev.imageUrl ?? null,
      status: ev.status,
    }),
  );
  created.events = (created.events ?? 0) + 1;

  const ttRepo = AppDataSource.getRepository(TicketType);
  for (const tt of ev.ticketTypes) {
    await ttRepo.save(
      ttRepo.create({
        eventId: event.id,
        name: tt.name,
        description: tt.description ?? null,
        priceCents: tt.priceCents,
        quantity: tt.quantity,
        quantitySold: tt.quantitySold ?? 0,
        salesStartsAt: tt.salesStartsInDays !== undefined && tt.salesStartsInDays !== null ? toDate(tt.salesStartsInDays) : null,
        salesEndsAt: tt.salesEndsInDays !== undefined && tt.salesEndsInDays !== null ? toDate(tt.salesEndsInDays) : null,
        isVisible: tt.isVisible ?? true,
        maxPerCustomer: tt.maxPerCustomer ?? null,
      }),
    );
    created.ticketTypes = (created.ticketTypes ?? 0) + 1;
  }
}

async function seedFavorites(): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);
  const eventRepo = AppDataSource.getRepository(Event);
  const favRepo = AppDataSource.getRepository(Favorite);

  for (const spec of SEED_FAVORITES) {
    const user = await userRepo.findOneBy({ email: spec.email });
    if (!user) continue;
    for (const eventName of spec.events) {
      const event = await eventRepo.findOneBy({ name: eventName });
      if (!event) continue;
      const existing = await favRepo.findOneBy({ userId: user.id, eventId: event.id });
      if (existing) continue;
      await favRepo.save(favRepo.create({ userId: user.id, eventId: event.id }));
      created.favorites = (created.favorites ?? 0) + 1;
    }
  }
}

interface SeedNotificationSpec {
  email: string;
  items: { type: NotificationType; channel: NotificationChannel; title: string; message: string | null; read: boolean }[];
}

const SEED_NOTIFICATIONS: SeedNotificationSpec[] = [
  {
    email: 'alice@example.com',
    items: [
      { type: 'ticket_reminder', channel: 'in_app', title: 'Neon Nights Festival starts tomorrow', message: 'Your tickets are ready in My Tickets.', read: false },
      { type: 'purchase_confirmed', channel: 'in_app', title: 'Order confirmed', message: 'Thanks! Your digital tickets are in My Tickets.', read: true },
    ],
  },
  {
    email: 'sam@example.com',
    items: [
      { type: 'ticket_reminder', channel: 'in_app', title: 'Theatre Gala Premiere is this weekend', message: 'Gate opens 30 minutes before start.', read: false },
      { type: 'purchase_confirmed', channel: 'in_app', title: 'Order confirmed', message: 'Thanks! Your digital tickets are in My Tickets.', read: true },
    ],
  },
  {
    email: 'mia@example.com',
    items: [
      { type: 'event_update', channel: 'in_app', title: 'City Sports Festival updated', message: 'Start time moved to 18:00.', read: false },
      { type: 'purchase_confirmed', channel: 'in_app', title: 'Order confirmed', message: 'Thanks! Your digital tickets are in My Tickets.', read: true },
    ],
  },
  {
    email: 'kai@example.com',
    items: [
      { type: 'ticket_reminder', channel: 'in_app', title: 'Indie Nights: Live Session starts soon', message: 'Show your QR code at the entrance.', read: false },
      { type: 'purchase_confirmed', channel: 'in_app', title: 'Order confirmed', message: 'Thanks! Your digital tickets are in My Tickets.', read: true },
    ],
  },
  {
    email: 'nina@example.com',
    items: [
      { type: 'purchase_confirmed', channel: 'in_app', title: 'Order confirmed', message: 'Thanks! Your digital tickets are in My Tickets.', read: false },
      { type: 'event_update', channel: 'in_app', title: 'Neon Nights Festival updated', message: 'New headliner announced.', read: true },
    ],
  },
];

async function seedNotifications(): Promise<void> {
  const userRepo = AppDataSource.getRepository(User);
  const notifRepo = AppDataSource.getRepository(Notification);

  for (const spec of SEED_NOTIFICATIONS) {
    const user = await userRepo.findOneBy({ email: spec.email });
    if (!user) continue;
    for (const item of spec.items) {
      const existing = await notifRepo.findOneBy({ userId: user.id, title: item.title });
      if (existing) continue;
      await notifRepo.save(
        notifRepo.create({
          userId: user.id,
          type: item.type,
          channel: item.channel,
          title: item.title,
          message: item.message,
          readAt: item.read ? new Date() : null,
        }),
      );
      created.notifications = (created.notifications ?? 0) + 1;
    }
  }
}

async function seedAll(): Promise<void> {
  await seedUsers();

  const categories = await seedCategories();
  const organizers = await seedOrganizers();
  const venues = await seedVenues();

  for (const ev of SEED_EVENTS) {
    await seedEvent(ev, categories, organizers, venues);
  }

  await seedFavorites();
  await seedNotifications();
}

async function main(): Promise<void> {
  await AppDataSource.initialize();
  try {
    await cleanupTestFixtures();
    await seedAll();

    const lines = Object.entries(created)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    console.log(`[seed] done. created ${lines || 'nothing'} (already present).`);
  } finally {
    await AppDataSource.destroy();
  }
}

void main();