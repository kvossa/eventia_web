import 'dotenv/config';
import bcrypt from 'bcrypt';
import { AppDataSource } from './config/data-source.js';
import { Category } from './entities/category.entity.js';
import { Event } from './entities/event.entity.js';
import { Favorite } from './entities/favorite.entity.js';
import { Notification } from './entities/notification.entity.js';
import { Organizer } from './entities/organizer.entity.js';
import { Seat } from './entities/seat.entity.js';
import { Section } from './entities/section.entity.js';
import { SeatRow } from './entities/seat-row.entity.js';
import { TicketType } from './entities/ticket-type.entity.js';
import { TicketTypeSection } from './entities/ticket-type-section.entity.js';
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
  SEED_VENUE_LAYOUTS,
  type SeedEvent,
} from './seed-data.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const BCRYPT_COST = 12;
const created: Record<string, number> = {};

const E2E_USER_PREDICATE = `(
  email ~ '^(alice|bob|buyer|buyer2|customer|pager|e2e)-[a-z0-9-]+@example[.]com$'
  OR email ~ '-[a-z0-9]{8}@example[.]com$'
  OR email LIKE 'audit%@t.local'
)`;

const throwawayNamePredicate = (alias: string): string => `(
  ${alias}name LIKE 'E2E %'
  OR ${alias}name LIKE 'Dbg %'
  OR ${alias}name LIKE 'D %'
  OR ${alias}name LIKE 'P Org probe-%'
  OR ${alias}name LIKE 'P Ev probe-%'
  OR ${alias}name LIKE '%(copy)%'
  OR ${alias}name = 'Harmony Events'
)`;

const THROWAWAY_NAME_PREDICATE = throwawayNamePredicate('');
const THROWAWAY_EVENT_PREDICATE = `(${throwawayNamePredicate('e.')} OR e."deletedAt" IS NOT NULL)`;

const purge = process.argv.includes('--purge');

async function cleanupTestFixtures(): Promise<void> {
  await AppDataSource.transaction(async (em) => {
    if (purge) {
      await em.query(`DELETE FROM orders`);
      await em.query(`DELETE FROM cart_items`);
      await em.query(`DELETE FROM carts`);
      await em.query(`DELETE FROM favorites`);
      await em.query(`DELETE FROM notifications`);
    } else {
      await em.query(`DELETE FROM orders WHERE user_id IN (SELECT id FROM users WHERE ${E2E_USER_PREDICATE})`);
      await em.query(
        `DELETE FROM orders WHERE EXISTS (
           SELECT 1 FROM order_items oi
           JOIN events e ON e.id = oi.event_id
           WHERE oi.order_id = orders.id AND ${THROWAWAY_EVENT_PREDICATE}
         )`,
      );
      await em.query(
        `DELETE FROM cart_items WHERE ticket_type_id IN (
           SELECT tt.id FROM ticket_types tt JOIN events e ON e.id = tt.event_id
           WHERE ${THROWAWAY_EVENT_PREDICATE}
         )`,
      );
    }
    await em.query(`DELETE FROM email_outbox`);
    await em.query(
      `DELETE FROM events WHERE ${THROWAWAY_NAME_PREDICATE} OR "deletedAt" IS NOT NULL`,
    );
    await em.query(
      `DELETE FROM venues WHERE ${THROWAWAY_NAME_PREDICATE} OR "deletedAt" IS NOT NULL`,
    );
    await em.query(
      `DELETE FROM organizers WHERE slug = 'harmony-events-2' OR ${THROWAWAY_NAME_PREDICATE} OR "deletedAt" IS NOT NULL`,
    );
    await em.query(`DELETE FROM categories WHERE ${THROWAWAY_NAME_PREDICATE}`);
    await em.query(
      `DELETE FROM notifications WHERE user_id IN (SELECT id FROM users WHERE ${E2E_USER_PREDICATE})`,
    );
    await em.query(
      `DELETE FROM favorites WHERE user_id IN (SELECT id FROM users WHERE ${E2E_USER_PREDICATE})`,
    );
    await em.query(`DELETE FROM carts WHERE user_id IN (SELECT id FROM users WHERE ${E2E_USER_PREDICATE})`);
    await em.query(`DELETE FROM users WHERE ${E2E_USER_PREDICATE}`);
  });
  console.log(
    purge
      ? '[seed --purge] full demo reset: dropped all orders, carts, favorites, notifications and the email outbox'
      : '[seed] removed test fixtures (E2E */Dbg */D */probe-* names, *(copy)*, Harmony Events, soft-deleted leftovers, throwaway e2e users and their orders/carts) and the email outbox',
  );
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

const toDateTime = (inDays: number, time?: string): Date => {
  const day = toDate(inDays);
  if (!time) return day;
  const [hours, minutes] = time.split(':').map((part) => Number.parseInt(part, 10));
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    throw new Error(`Invalid seed time "${time}" for event date, expected HH:MM (UTC)`);
  }
  const midnight = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate());
  return new Date(midnight + hours * HOUR_MS + minutes * MINUTE_MS);
};

async function ensureRow(
  sectionId: string,
  label: string,
  seatCount: number,
  accessibleNumbers: number[],
): Promise<void> {
  const rowsRepo = AppDataSource.getRepository(SeatRow);
  const seatsRepo = AppDataSource.getRepository(Seat);
  const row = await rowsRepo.save(rowsRepo.create({ sectionId, label }));
  const accessible = new Set(accessibleNumbers);
  const seats: { rowId: string; number: number; isAccessible: boolean }[] = [];
  for (let n = 1; n <= seatCount; n++) {
    seats.push({ rowId: row.id, number: n, isAccessible: accessible.has(n) });
  }
  await seatsRepo.save(seatsRepo.create(seats));
}

async function seedVenueLayouts(): Promise<void> {
  const venuesRepo = AppDataSource.getRepository(Venue);
  const sectionsRepo = AppDataSource.getRepository(Section);
  let seeded = 0;

  for (const layout of SEED_VENUE_LAYOUTS) {
    const venue = await venuesRepo.findOneBy({ name: layout.venueName });
    if (!venue) continue;
    if ((await sectionsRepo.count({ where: { venueId: venue.id } })) > 0) continue;

    for (const [sectionIndex, section] of layout.sections.entries()) {
      const saved = await sectionsRepo.save(
        sectionsRepo.create({ venueId: venue.id, name: section.name, sortOrder: sectionIndex }),
      );
      for (const row of section.rows) {
        await ensureRow(saved.id, row.label, row.seats, row.accessibleSeats ?? []);
      }
    }
    seeded += 1;
  }
  created.layouts = seeded;
}

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
      dateTime: toDateTime(ev.inDays, ev.time),
      city: ev.city ?? venue.city,
      address: ev.address ?? venue.address,
      maxCapacity: ev.maxCapacity ?? null,
      ageRestriction: ev.ageRestriction ?? null,
      accessibilityInfo: null,
      featured: ev.featured ?? false,
      reservedSeating: ev.reservedSeating ?? false,
      imageUrl: ev.imageUrl ?? null,
      status: ev.status,
    }),
  );
  created.events = (created.events ?? 0) + 1;

  const ttRepo = AppDataSource.getRepository(TicketType);
  const ttSectionRepo = AppDataSource.getRepository(TicketTypeSection);
  const sectionsRepo = AppDataSource.getRepository(Section);
  const sectionsByVenue = ev.reservedSeating
    ? await sectionsRepo.find({ where: { venueId: venue.id } })
    : [];
  for (const tt of ev.ticketTypes) {
    const saved = await ttRepo.save(
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

    if (ev.reservedSeating && tt.sections) {
      const bound = sectionsByVenue.filter((section) => tt.sections?.includes(section.name));
      if (bound.length > 0) {
        await ttSectionRepo.save(
          bound.map((section) =>
            ttSectionRepo.create({ ticketTypeId: saved.id, sectionId: section.id }),
          ),
        );
      }
    }
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

async function resetSeededTicketStock(): Promise<void> {
  const ttRepo = AppDataSource.getRepository(TicketType);
  const eventRepo = AppDataSource.getRepository(Event);
  let reset = 0;

  for (const ev of SEED_EVENTS) {
    const event = await eventRepo.findOneBy({ name: ev.name });
    if (!event) continue;
    for (const tt of ev.ticketTypes) {
      const sold = tt.quantitySold ?? 0;
      const existing = await ttRepo.findOneBy({ eventId: event.id, name: tt.name });
      if (!existing || existing.quantitySold === sold) continue;
      existing.quantitySold = sold;
      await ttRepo.save(existing);
      reset += 1;
    }
  }
  created.stockResets = reset;
}

async function seedAll(): Promise<void> {
  await seedUsers();

  const categories = await seedCategories();
  const organizers = await seedOrganizers();
  const venues = await seedVenues();
  await seedVenueLayouts();

  for (const ev of SEED_EVENTS) {
    await seedEvent(ev, categories, organizers, venues);
  }

  if (purge) await resetSeededTicketStock();

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