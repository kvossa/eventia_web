import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureTestApp } from './test-app.helper.js';

const ADMIN_EMAIL = 'root@eventia.local';
const ADMIN_PASSWORD = 'adminpass1234';
const suffix = `ev-${Date.now().toString(36)}`;

function send(
  app: INestApplication,
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  token?: string,
  body?: unknown,
): request.Test {
  let req = request(app.getHttpServer())[method](path);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  return body !== undefined ? req.send(body as object) : req;
}

describe('Events list filters (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let concertId: string;
  let concertSlug: string;
  let theatreId: string;
  let theatreSlug: string;
  let earlyId: string;
  let lateId: string;
  let pastEventId: string;
  let pastTicketTypeId: string;

  const names = (res: { body: { data: { name: string }[] } }): string[] =>
    res.body.data.map((e) => e.name);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureTestApp(app);
    await app.init();

    const login = await send(app, 'post', '/api/v1/auth/login', undefined, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }).expect(200);
    adminToken = login.body.accessToken;

    const concert = await send(app, 'post', '/api/v1/categories', adminToken, {
      name: `E2E Concert ${suffix}`,
      slug: `e2e-concert-${suffix}`,
    }).expect(201);
    concertId = concert.body.id;
    concertSlug = concert.body.slug;

    const theatre = await send(app, 'post', '/api/v1/categories', adminToken, {
      name: `E2E Theatre ${suffix}`,
      slug: `e2e-theatre-${suffix}`,
    }).expect(201);
    theatreId = theatre.body.id;
    theatreSlug = theatre.body.slug;

    const organizer = await send(app, 'post', '/api/v1/organizers', adminToken, {
      name: `E2E Organizer ${suffix}`,
      slug: `e2e-organizer-${suffix}`,
    }).expect(201);
    const venue = await send(app, 'post', '/api/v1/venues', adminToken, {
      name: `E2E Filter Arena ${suffix}`,
      city: 'Berlin',
      address: 'Filterstr. 7',
    }).expect(201);

    const mk = async (
      name: string,
      dateTime: string,
      categoryId: string,
      publish = true,
    ): Promise<{ id: string; ticketTypeId?: string }> => {
      const created = await send(app, 'post', '/api/v1/events', adminToken, {
        name,
        description: 'Filter fixture',
        categoryId,
        organizerId: organizer.body.id,
        venueId: venue.body.id,
        dateTime,
      }).expect(201);
      if (publish) {
        await send(app, 'post', `/api/v1/events/${created.body.id}/publish`, adminToken, {}).expect(201);
      }
      const type = await send(app, 'post', '/api/v1/ticket-types', adminToken, {
        eventId: created.body.id,
        name: 'General Admission',
        priceCents: 5000,
        quantity: 50,
      }).expect(201);
      return { id: created.body.id as string, ticketTypeId: type.body.id as string };
    };

    earlyId = (await mk(`E2E Early ${suffix}`, '2027-01-10T19:00:00.000Z', concertId)).id;
    lateId = (await mk(`E2E Late ${suffix}`, '2027-06-20T19:00:00.000Z', concertId)).id;
    await mk(`E2E Musical ${suffix}`, '2027-01-10T19:00:00.000Z', theatreId);

    const past = await mk(
      `E2E Past ${suffix}`,
      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      concertId,
    );
    pastEventId = past.id;
    pastTicketTypeId = past.ticketTypeId as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists published events when no filter is applied', async () => {
    const res = await send(app, 'get', '/api/v1/events?limit=100').expect(200);
    expect(res.body.total).toBeGreaterThan(0);
  });

  it('filters by category slug', async () => {
    const res = await send(app, 'get', `/api/v1/events?category=${concertSlug}&limit=100`).expect(200);
    const found = names(res);
    expect(found).toContain(`E2E Early ${suffix}`);
    expect(found).toContain(`E2E Late ${suffix}`);
    expect(found).not.toContain(`E2E Musical ${suffix}`);
  });

  it('filters by category id as well as slug', async () => {
    const byId = await send(app, 'get', `/api/v1/events?category=${concertId}&limit=100`).expect(200);
    const bySlug = await send(app, 'get', `/api/v1/events?category=${concertSlug}&limit=100`).expect(200);
    expect(names(byId)).toEqual(names(bySlug));
  });

  it('keeps categories independent from each other', async () => {
    const res = await send(app, 'get', `/api/v1/events?category=${theatreSlug}&limit=100`).expect(200);
    const found = names(res);
    expect(found).toContain(`E2E Musical ${suffix}`);
    expect(found).not.toContain(`E2E Early ${suffix}`);
  });

  it('returns an empty list for an unknown category instead of 400', async () => {
    const res = await send(app, 'get', '/api/v1/events?category=nope-does-not-exist').expect(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });

  it('filters by dateFrom and dateTo', async () => {
    const all = await send(app, 'get', '/api/v1/events?limit=100').expect(200);
    const total = all.body.total as number;

    const fromOnly = await send(app, 'get', '/api/v1/events?dateFrom=2027-01-01&limit=100').expect(200);
    expect(fromOnly.body.total).toBeLessThan(total);

    const window = await send(app, 'get', '/api/v1/events?dateFrom=2027-01-01&dateTo=2027-01-31&limit=100').expect(200);
    const inWindow = names(window);
    expect(inWindow).toContain(`E2E Early ${suffix}`);
    expect(inWindow).not.toContain(`E2E Late ${suffix}`);

    const toOnly = await send(app, 'get', '/api/v1/events?dateTo=2026-01-01&limit=100').expect(200);
    expect(toOnly.body.data).toHaveLength(0);
  });

  it('combines category and date filters', async () => {
    const res = await send(
      app,
      'get',
      `/api/v1/events?category=${concertSlug}&dateFrom=2027-01-01&dateTo=2027-01-31&limit=100`,
    ).expect(200);
    const found = names(res);
    expect(found).toEqual([`E2E Early ${suffix}`]);
  });

  it('still filters by keyword', async () => {
    const res = await send(app, 'get', `/api/v1/events?q=E2E%20Early%20${suffix}`).expect(200);
    expect(names(res)).toEqual([`E2E Early ${suffix}`]);

    const miss = await send(app, 'get', '/api/v1/events?q=zzzzz-no-such-event').expect(200);
    expect(miss.body.data).toHaveLength(0);
  });

  it('exposes both fixture dates and the category ids it asserts on', () => {
    expect(earlyId).not.toBe(lateId);
  });

  describe('past events', () => {
    it('excludes a published event that has already happened from the public list', async () => {
      const res = await send(app, 'get', '/api/v1/events?limit=100').expect(200);
      const ids = (res.body.data as { id: string }[]).map((e) => e.id);

      expect(ids).not.toContain(pastEventId);
      expect(names(res)).not.toContain(`E2E Past ${suffix}`);
      expect(ids).toContain(earlyId);
    });

    it('still lists the past event in the admin list so it can be managed', async () => {
      const res = await send(app, 'get', '/api/v1/admin/events?limit=100', adminToken).expect(200);
      const ids = (res.body.data as { id: string }[]).map((e) => e.id);
      expect(ids).toContain(pastEventId);
    });

    it('rejects adding a ticket for an event that has already happened', async () => {
      const res = await send(app, 'post', '/api/v1/cart/items', undefined, {
        ticketTypeId: pastTicketTypeId,
        quantity: 1,
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(res.body)).toContain('already taken place');
    });
  });

  describe('dateTo boundary', () => {
    it('includes an event later on the selected end day', async () => {
      const res = await send(app, 'get', '/api/v1/events?dateTo=2027-01-10&limit=100').expect(200);
      const found = names(res);
      expect(found).toContain(`E2E Early ${suffix}`);
      expect(found).toContain(`E2E Musical ${suffix}`);
    });

    it('returns events for a single-day from/to range', async () => {
      const res = await send(
        app,
        'get',
        '/api/v1/events?dateFrom=2027-01-10&dateTo=2027-01-10&limit=100',
      ).expect(200);
      const found = names(res);
      expect(found).toContain(`E2E Early ${suffix}`);
      expect(found).not.toContain(`E2E Late ${suffix}`);
    });

    it('excludes an event on the day after the end day', async () => {
      const before = await send(app, 'get', '/api/v1/events?dateTo=2027-01-09&limit=100').expect(200);
      expect(names(before)).not.toContain(`E2E Early ${suffix}`);

      const onEndDay = await send(app, 'get', '/api/v1/events?dateTo=2027-01-10&limit=100').expect(200);
      expect(names(onEndDay)).toContain(`E2E Early ${suffix}`);
    });

    it('excludes events on a later day when the range ends before them', async () => {
      const res = await send(
        app,
        'get',
        '/api/v1/events?dateFrom=2027-01-01&dateTo=2027-01-10&limit=100',
      ).expect(200);
      const found = names(res);
      expect(found).toContain(`E2E Early ${suffix}`);
      expect(found).not.toContain(`E2E Late ${suffix}`);
    });

    it('keeps exact timestamp semantics when dateTo carries a time', async () => {
      const before = await send(
        app,
        'get',
        '/api/v1/events?dateTo=2027-01-10T18:00:00.000Z&limit=100',
      ).expect(200);
      expect(names(before)).not.toContain(`E2E Early ${suffix}`);

      const after = await send(
        app,
        'get',
        '/api/v1/events?dateTo=2027-01-10T19:00:00.000Z&limit=100',
      ).expect(200);
      expect(names(after)).toContain(`E2E Early ${suffix}`);
    });

    it('rejects a malformed date rather than silently ignoring it', async () => {
      await send(app, 'get', '/api/v1/events?dateTo=not-a-date').expect(422);
    });
  });
});
