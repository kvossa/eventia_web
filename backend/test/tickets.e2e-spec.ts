import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureTestApp } from './test-app.helper.js';

const ADMIN_EMAIL = 'root@eventia.local';
const ADMIN_PASSWORD = 'adminpass1234';
const suffix = `tix-${Date.now().toString(36)}`;

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

function send(
  app: INestApplication,
  method: Method,
  path: string,
  token?: string,
  body?: unknown,
): request.Test {
  let req = request(app.getHttpServer())[method](path);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  return body !== undefined ? req.send(body as object) : req;
}

describe('My tickets ordering and soft-deleted events (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let laterEventId: string;
  let earlierTicketId: string;
  let laterTicketId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureTestApp(app);
    await app.init();

    const adminLogin = await send(app, 'post', '/api/v1/auth/login', undefined, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }).expect(200);
    adminToken = adminLogin.body.accessToken;

    const user = await send(app, 'post', '/api/v1/auth/register', undefined, {
      email: `buyer-${suffix}@example.com`,
      password: 'buyerpass123',
      name: 'Ticket Buyer',
    }).expect(201);
    userToken = user.body.accessToken;

    const category = await send(app, 'post', '/api/v1/categories', adminToken, {
      name: `E2E Tix Cat ${suffix}`,
      slug: `e2e-tix-cat-${suffix}`,
    }).expect(201);
    const organizer = await send(app, 'post', '/api/v1/organizers', adminToken, {
      name: `E2E Tix Org ${suffix}`,
      slug: `e2e-tix-org-${suffix}`,
    }).expect(201);
    const venueId = (
      await send(app, 'post', '/api/v1/venues', adminToken, {
        name: `E2E Tix Arena ${suffix}`,
        city: 'Berlin',
        address: 'Tixstr. 1',
      }).expect(201)
    ).body.id;

    const createEvent = async (name: string, days: number) => {
      const event = await send(app, 'post', '/api/v1/events', adminToken, {
        name,
        categoryId: category.body.id,
        organizerId: organizer.body.id,
        venueId,
        dateTime: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
      }).expect(201);
      await send(app, 'post', `/api/v1/events/${event.body.id}/publish`, adminToken).expect(201);
      const tt = await send(app, 'post', '/api/v1/ticket-types', adminToken, {
        eventId: event.body.id,
        name: 'GA',
        priceCents: 1000,
        quantity: 50,
      }).expect(201);
      return { eventId: event.body.id as string, ttId: tt.body.id as string };
    };

    const earlier = await createEvent(`E2E Tix Earlier ${suffix}`, 30);
    const later = await createEvent(`E2E Tix Later ${suffix}`, 60);
    laterEventId = later.eventId;

    // Buy the LATER event first, then the EARLIER one, so purchase order and
    // event-date order genuinely differ.
    await send(app, 'post', '/api/v1/cart/items', userToken, {
      ticketTypeId: later.ttId,
      quantity: 1,
    }).expect(201);
    const firstCheckout = await send(app, 'post', '/api/v1/checkout', userToken, {
      idempotencyKey: `tix-e2e-later-${suffix}`,
    }).expect(201);
    laterTicketId = firstCheckout.body.items[0].tickets[0].id;

    await send(app, 'post', '/api/v1/cart/items', userToken, {
      ticketTypeId: earlier.ttId,
      quantity: 1,
    }).expect(201);
    const secondCheckout = await send(app, 'post', '/api/v1/checkout', userToken, {
      idempotencyKey: `tix-e2e-earlier-${suffix}`,
    }).expect(201);
    earlierTicketId = secondCheckout.body.items[0].tickets[0].id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('orders upcoming tickets by event date, not purchase date', async () => {
    const list = await send(app, 'get', '/api/v1/tickets?scope=all', userToken).expect(200);
    const ids = list.body.data.map((t: { id: string }) => t.id);

    expect(ids).toEqual([laterTicketId, earlierTicketId]);
  });

  it('keeps a paid ticket when its event is soft-deleted and flags it', async () => {
    const before = await send(app, 'get', `/api/v1/tickets/${laterTicketId}`, userToken).expect(200);
    expect(before.body.event.deleted).toBe(false);

    await send(app, 'delete', `/api/v1/events/${laterEventId}`, adminToken).expect(200);

    const list = await send(app, 'get', '/api/v1/tickets?scope=all', userToken).expect(200);
    const ids = list.body.data.map((t: { id: string }) => t.id);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(laterTicketId);

    const later = list.body.data.find((t: { id: string }) => t.id === laterTicketId);
    expect(later.event.deleted).toBe(true);
    expect(later.event.name).toBe(`E2E Tix Later ${suffix}`);

    const detail = await send(app, 'get', `/api/v1/tickets/${laterTicketId}`, userToken).expect(200);
    expect(detail.body.event.deleted).toBe(true);
  });
});