import { describe, expect, it } from 'vitest';
import {
  SEED_CATEGORIES,
  SEED_EVENTS,
  SEED_VENUES,
  SEED_VENUE_LAYOUTS,
  type SeedEvent,
} from './seed-data.js';

const layoutFor = (venueName: string) =>
  SEED_VENUE_LAYOUTS.find((layout) => layout.venueName === venueName);

const seatsInSection = (venueName: string, sectionName: string): number | undefined =>
  layoutFor(venueName)
    ?.sections.find((section) => section.name === sectionName)
    ?.rows.reduce((total, row) => total + row.seats, 0);

const reservedEvents = SEED_EVENTS.filter((ev) => ev.reservedSeating);

describe('seed event times', () => {
  it('gives every seeded event a UTC wall-clock time in HH:MM', () => {
    for (const ev of SEED_EVENTS) {
      expect(ev.time, ev.name).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
  });

  it('keeps the past events to a single deliberate demo and dates everything else ahead', () => {
    const past = SEED_EVENTS.filter((ev) => ev.inDays < 0).map((ev) => ev.name);
    expect(past).toEqual(['Last Summer Open Air']);
    for (const ev of SEED_EVENTS.filter((e) => e.inDays >= 0)) {
      expect(ev.inDays, ev.name).toBeGreaterThan(0);
    }
  });
});

describe('seed catalog integrity', () => {
  it('keeps event names, slugs and emails unique', () => {
    expect(new Set(SEED_EVENTS.map((ev) => ev.name)).size).toBe(SEED_EVENTS.length);
    expect(new Set(SEED_CATEGORIES.map((c) => c.slug)).size).toBe(SEED_CATEGORIES.length);
    expect(new Set(SEED_VENUES.map((v) => v.name)).size).toBe(SEED_VENUES.length);
  });

  it('references known categories, organizers and venues', () => {
    const categories = new Set(SEED_CATEGORIES.map((c) => c.slug));
    const venues = new Set(SEED_VENUES.map((v) => v.name));
    for (const ev of SEED_EVENTS) {
      expect(categories.has(ev.categorySlug), `${ev.name} → ${ev.categorySlug}`).toBe(true);
      expect(venues.has(ev.venueName), `${ev.name} → ${ev.venueName}`).toBe(true);
    }
  });

  it('never sells more than the seeded quantity and keeps prices positive', () => {
    for (const ev of SEED_EVENTS) {
      for (const tt of ev.ticketTypes) {
        expect(tt.priceCents, `${ev.name} → ${tt.name}`).toBeGreaterThan(0);
        expect(tt.quantity, `${ev.name} → ${tt.name}`).toBeGreaterThan(0);
        expect(tt.quantitySold ?? 0, `${ev.name} → ${tt.name}`).toBeLessThanOrEqual(tt.quantity);
        expect(tt.maxPerCustomer ?? 1, `${ev.name} → ${tt.name}`).toBeLessThanOrEqual(tt.quantity);
      }
    }
  });

  it('keeps the event capacity at or above the total ticket inventory', () => {
    for (const ev of SEED_EVENTS) {
      const total = ev.ticketTypes.reduce((sum, tt) => sum + tt.quantity, 0);
      if (ev.maxCapacity === undefined) continue;
      expect(total, ev.name).toBeLessThanOrEqual(ev.maxCapacity);
    }
  });
});

describe('seed seat layouts', () => {
  it('gives every reserved event a layout for its venue', () => {
    expect(reservedEvents.length).toBeGreaterThan(0);
    for (const ev of reservedEvents) {
      expect(layoutFor(ev.venueName), `${ev.name} → ${ev.venueName}`).toBeDefined();
    }
  });

  it('binds every reserved ticket type to real sections', () => {
    for (const ev of reservedEvents) {
      for (const tt of ev.ticketTypes) {
        expect(tt.sections?.length, `${ev.name} → ${tt.name}`).toBeGreaterThan(0);
        for (const section of tt.sections ?? []) {
          expect(seatsInSection(ev.venueName, section), `${ev.name} → ${tt.name} → ${section}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('never allocates more tickets to a section than it has seats', () => {
    for (const ev of reservedEvents) {
      const layout = layoutFor(ev.venueName);
      for (const section of layout?.sections ?? []) {
        const allocated = ev.ticketTypes
          .filter((tt) => tt.sections?.includes(section.name))
          .reduce((sum, tt) => sum + tt.quantity, 0);
        const seats = section.rows.reduce((sum, row) => sum + row.seats, 0);
        expect(allocated, `${ev.name} → ${section.name}`).toBeLessThanOrEqual(seats);
      }
    }
  });

  it('seeds reserved events with zero sold seats so the seat map matches the badge', () => {
    for (const ev of reservedEvents) {
      for (const tt of ev.ticketTypes) {
        expect(tt.quantitySold ?? 0, `${ev.name} → ${tt.name}`).toBe(0);
      }
    }
  });

  it('only declares accessible seats that exist in the row', () => {
    for (const layout of SEED_VENUE_LAYOUTS) {
      for (const section of layout.sections) {
        for (const row of section.rows) {
          for (const seat of row.accessibleSeats ?? []) {
            expect(seat, `${layout.venueName} → ${section.name} → ${row.label}`).toBeGreaterThanOrEqual(1);
            expect(seat, `${layout.venueName} → ${section.name} → ${row.label}`).toBeLessThanOrEqual(row.seats);
          }
        }
      }
    }
  });

  it('uses unique row labels and section names per venue', () => {
    for (const layout of SEED_VENUE_LAYOUTS) {
      const sectionNames = layout.sections.map((s) => s.name);
      expect(new Set(sectionNames).size, layout.venueName).toBe(sectionNames.length);
      for (const section of layout.sections) {
        const labels = section.rows.map((r) => r.label);
        expect(new Set(labels).size, `${layout.venueName} → ${section.name}`).toBe(labels.length);
      }
    }
  });

  it('is a no-op for venues without a layout entry', () => {
    const withoutLayout = SEED_VENUES.filter((v) => !layoutFor(v.name));
    expect(withoutLayout.map((v) => v.name).sort()).toEqual(
      SEED_EVENTS.filter((ev) => !ev.reservedSeating)
        .map((ev: SeedEvent) => ev.venueName)
        .filter((name) => !layoutFor(name))
        .filter((name, index, all) => all.indexOf(name) === index)
        .sort(),
    );
  });
});
