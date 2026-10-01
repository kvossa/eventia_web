import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureTestApp } from './test-app.helper.js';
import { Event } from '../src/entities/event.entity.js';
import { TicketType } from '../src/entities/ticket-type.entity.js';

type Seat = { id: string; number: number; isAccessible: boolean; occupied: boolean; held: boolean };
type Row = { id: string; label: string; seats: Seat[] };
type Section = { id: string; name: string; rows: Row[] };
type MapTicketType = { id: string; name: string; priceCents: number; sectionIds: string[] };

interface Expected {
  event: string;
  sections: { name: string; seats: number; rows: string[] }[];
  ticketTypes: { name: string; sections: string[] }[];
}

const EXPECTED: Expected[] = [
  {
    event: 'Comedy Cellar Nights',
    sections: [
      { name: 'Stalls', seats: 26, rows: ['A', 'B'] },
      { name: 'Balcony', seats: 8, rows: ['1'] },
    ],
    ticketTypes: [
      { name: 'Early Bird', sections: ['Stalls'] },
      { name: 'Standard', sections: ['Stalls'] },
      { name: 'Late Show', sections: ['Balcony'] },
    ],
  },
  {
    event: 'Riverside Electronic Weekend',
    sections: [
      { name: 'Main Floor', seats: 80, rows: ['A', 'B'] },
      { name: 'Gallery', seats: 20, rows: ['1'] },
    ],
    ticketTypes: [
      { name: 'Day Pass', sections: ['Main Floor'] },
      { name: 'Weekend Ticket', sections: ['Main Floor'] },
      { name: 'VIP Deck', sections: ['Gallery'] },
    ],
  },
];

describe('Seeded seat layouts (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureTestApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const eventByName = (name: string): Promise<Event | null> =>
    dataSource.getRepository(Event).findOneBy({ name });

  const ticketTypesOf = (eventId: string): Promise<TicketType[]> =>
    dataSource.getRepository(TicketType).find({ where: { eventId } });

  it('ships both reserved demo events with their flag and a venue layout', async () => {
    for (const expected of EXPECTED) {
      const event = await eventByName(expected.event);
      expect(event, expected.event).not.toBeNull();
      expect(event!.reservedSeating, expected.event).toBe(true);
      expect(event!.venueId, expected.event).toBeDefined();
    }
  });

  it.each(EXPECTED)('serves the $event layout with sections, rows and seats in seed order', async (expected) => {
    const event = (await eventByName(expected.event))!;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${event.id}/seat-map`)
      .expect(200);

    const sections = res.body.sections as Section[];
    expect(sections.map((s) => s.name)).toEqual(expected.sections.map((s) => s.name));

    for (const [index, want] of expected.sections.entries()) {
      const section = sections[index];
      expect(section.rows.map((r) => r.label), `${expected.event} → ${want.name}`).toEqual(want.rows);
      const seats = section.rows.flatMap((r) => r.seats);
      expect(seats, `${expected.event} → ${want.name}`).toHaveLength(want.seats);
      expect(seats.map((s) => s.number)).toEqual(
        section.rows.flatMap((r) => Array.from({ length: r.seats.length }, (_, i) => i + 1)),
      );
    }
  });

  it.each(EXPECTED)('binds the $event ticket types to the seeded sections', async (expected) => {
    const event = (await eventByName(expected.event))!;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${event.id}/seat-map`)
      .expect(200);

    const mapTicketTypes = res.body.ticketTypes as MapTicketType[];
    const sections = res.body.sections as Section[];
    expect(mapTicketTypes.map((tt) => tt.name).sort()).toEqual(expected.ticketTypes.map((tt) => tt.name).sort());

    for (const want of expected.ticketTypes) {
      const entry = mapTicketTypes.find((tt) => tt.name === want.name)!;
      expect(
        entry.sectionIds.map((id) => sections.find((s) => s.id === id)?.name).sort(),
        `${expected.event} → ${want.name}`,
      ).toEqual([...want.sections].sort());
    }
  });

  it.each(EXPECTED)('allocates no more $event tickets than the bound sections hold', async (expected) => {
    const event = (await eventByName(expected.event))!;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${event.id}/seat-map`)
      .expect(200);

    const sections = res.body.sections as Section[];
    const mapTicketTypes = res.body.ticketTypes as MapTicketType[];
    const ticketTypes = await ticketTypesOf(event.id);

    for (const tt of ticketTypes) {
      const entry = mapTicketTypes.find((x) => x.id === tt.id)!;
      expect(entry, `${expected.event} → ${tt.name}`).toBeDefined();
      const capacity = entry.sectionIds.reduce(
        (sum, id) => sum + (sections.find((s) => s.id === id)?.rows.flatMap((r) => r.seats).length ?? 0),
        0,
      );
      const allocated = ticketTypes
        .filter((other) => {
          const otherEntry = mapTicketTypes.find((x) => x.id === other.id)!;
          return otherEntry.sectionIds.some((sectionId) => entry.sectionIds.includes(sectionId));
        })
        .reduce((sum, other) => sum + other.quantity, 0);
      expect(allocated, `${expected.event} → ${tt.name} shares sections`).toBeLessThanOrEqual(capacity);
    }
  });

  it.each(EXPECTED)('leaves every $event seat free so the map matches the availability badge', async (expected) => {
    const event = (await eventByName(expected.event))!;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${event.id}/seat-map`)
      .expect(200);

    const seats = (res.body.sections as Section[]).flatMap((s) => s.rows.flatMap((r) => r.seats));
    expect(seats.filter((s) => s.occupied)).toEqual([]);
    expect(seats.filter((s) => s.held)).toEqual([]);

    const ticketTypes = await ticketTypesOf(event.id);
    for (const tt of ticketTypes) {
      expect(tt.quantitySold, `${expected.event} → ${tt.name}`).toBe(0);
    }
  });

  it('marks the seeded accessible seats in the first row of each section', async () => {
    const event = (await eventByName('Comedy Cellar Nights'))!;
    const res = await request(app.getHttpServer())
      .get(`/api/v1/events/${event.id}/seat-map`)
      .expect(200);

    const sections = res.body.sections as Section[];
    const stallsA = sections.find((s) => s.name === 'Stalls')!.rows.find((r) => r.label === 'A')!;
    const accessible = stallsA.seats.filter((s) => s.isAccessible).map((s) => s.number);
    expect(accessible).toEqual([1, 14]);

    const balcony = sections.find((s) => s.name === 'Balcony')!;
    expect(balcony.rows.flatMap((r) => r.seats).some((s) => s.isAccessible)).toBe(false);
  });
});
