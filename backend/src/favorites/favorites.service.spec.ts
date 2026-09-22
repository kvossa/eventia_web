import { describe, expect, it } from 'vitest';
import type { EventListItem } from '../events/events.service.js';
import { NotFoundError } from '../common/app-error.js';
import { FavoritesService } from './favorites.service.js';

function makeEvent(id: string): EventListItem {
  return {
    id,
    name: `Event ${id}`,
    description: null,
    categoryId: 'cat-1',
    organizerId: 'org-1',
    venueId: 'ven-1',
    dateTime: new Date('2026-12-01T19:00:00Z'),
    startTime: null,
    endTime: null,
    maxCapacity: null,
    ageRestriction: null,
    accessibilityInfo: null,
    city: 'Berlin',
    address: 'Teststr. 1',
    featured: false,
    imageUrl: null,
    status: 'published',
    availability: {
      state: 'available',
      totalStock: 100,
      soldCount: 10,
      soldPercent: 10,
    },
    ticketTypes: [],
    fromPriceCents: 1500,
  };
}

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    find: async () => [],
    findOne: async () => null,
    save: async (v: unknown) => v,
    create: (v: unknown) => v,
    delete: async () => ({ affected: 0 }),
    ...overrides,
  };
}

describe('FavoritesService', () => {
  it('lists favorites decorated with availability and favoritedAt', async () => {
    const fav = {
      id: 'f1',
      userId: 'u1',
      eventId: 'e1',
      createdAt: new Date('2026-09-18T08:00:00Z'),
      event: makeEvent('e1') as never,
    };
    const repo = makeRepo({ find: async () => [fav] });
    const eventsService = {
      decorateEvents: async (events: EventListItem[]) => events.map((e) => ({ ...makeEvent('e1'), ...e })),
    };
    const service = new FavoritesService(repo as never, eventsService as never);

    const result = await service.listForUser('u1');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].name).toBe('Event e1');
    expect(result.data[0].favoritedAt).toBe('2026-09-18T08:00:00.000Z');
  });

  it('add returns the event id when a favorite already exists (idempotent)', async () => {
    const existing = { id: 'f1', userId: 'u1', eventId: 'e1' };
    const repo = makeRepo({ findOne: async () => existing });
    const service = new FavoritesService(repo as never, { findById: async () => null } as never);

    const result = await service.add('u1', 'e1');
    expect(result).toEqual({ id: 'e1' });
  });

  it('creates a favorite for a real event', async () => {
    const saved: Record<string, unknown>[] = [];
    const repo = makeRepo({
      findOne: async () => null,
      save: async (v: unknown) => {
        saved.push(v as Record<string, unknown>);
        return { id: 'f1', ...(v as object) };
      },
      create: (v: unknown) => v,
    });
    const service = new FavoritesService(repo as never, { findById: async () => makeEvent('e1') } as never);

    const result = await service.add('u1', 'e1');
    expect(saved[0]).toMatchObject({ userId: 'u1', eventId: 'e1' });
    expect(result).toEqual({ id: 'e1' });
  });

  it('throws NotFoundError when the event does not exist', async () => {
    const repo = makeRepo({ findOne: async () => null });
    const service = new FavoritesService(repo as never, { findById: async () => null } as never);

    await expect(service.add('u1', 'missing')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('removes a favorite', async () => {
    const calls: [string, string][] = [];
    const repo = makeRepo({
      delete: async (criteria: { userId: string; eventId: string }) => {
        calls.push([criteria.userId, criteria.eventId]);
        return { affected: 1 };
      },
    });
    const service = new FavoritesService(repo as never, {} as never);

    await service.remove('u1', 'e1');
    expect(calls).toEqual([['u1', 'e1']]);
  });
});