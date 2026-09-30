import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureTestApp } from './test-app.helper.js';

const ADMIN_EMAIL = 'root@eventia.local';
const ADMIN_PASSWORD = 'adminpass1234';
const suffix = `st-${Date.now().toString(36)}`;
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';

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

describe('Admin generic event status (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let eventId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureTestApp(app);
    await app.init();

    adminToken = (
      await send(app, 'post', '/api/v1/auth/login', undefined, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }).expect(200)
    ).body.accessToken;

    const category = await send(app, 'post', '/api/v1/categories', adminToken, {
      name: `E2E Status Cat ${suffix}`,
      slug: `e2e-status-cat-${suffix}`,
    }).expect(201);
    const organizer = await send(app, 'post', '/api/v1/organizers', adminToken, {
      name: `E2E Status Org ${suffix}`,
      slug: `e2e-status-org-${suffix}`,
    }).expect(201);
    const venue = await send(app, 'post', '/api/v1/venues', adminToken, {
      name: `E2E Status Hall ${suffix}`,
      city: 'Berlin',
      address: 'Statusstr. 3',
    }).expect(201);
    eventId = (
      await send(app, 'post', '/api/v1/events', adminToken, {
        name: `E2E Status ${suffix}`,
        categoryId: category.body.id,
        organizerId: organizer.body.id,
        venueId: venue.body.id,
        dateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      }).expect(201)
    ).body.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('sets each writeable status through the generic endpoint', async () => {
    expect(
      (
        await send(app, 'patch', `/api/v1/admin/events/${eventId}/status`, adminToken, {
          status: 'published',
        }).expect(200)
      ).body.status,
    ).toBe('published');
    expect(
      (
        await send(app, 'patch', `/api/v1/admin/events/${eventId}/status`, adminToken, {
          status: 'draft',
        }).expect(200)
      ).body.status,
    ).toBe('draft');
    expect(
      (
        await send(app, 'patch', `/api/v1/admin/events/${eventId}/status`, adminToken, {
          status: 'sold_out',
        }).expect(200)
      ).body.status,
    ).toBe('sold_out');
  });

  it('rejects statuses outside the writeable set and malformed bodies', async () => {
    for (const status of ['cancelled', 'finished', 'nonsense']) {
      const res = await send(app, 'patch', `/api/v1/admin/events/${eventId}/status`, adminToken, {
        status,
      }).expect(400);
      expect(res.body.code).toBe('BAD_REQUEST');
    }
    const extra = await send(app, 'patch', `/api/v1/admin/events/${eventId}/status`, adminToken, {
      status: 'published',
      extraKey: 1,
    }).expect(400);
    expect(extra.body.code).toBe('BAD_REQUEST');
  });

  it('404s for a missing event and 403s for non-admins', async () => {
    await send(app, 'patch', `/api/v1/admin/events/${UNKNOWN_ID}/status`, adminToken, {
      status: 'published',
    }).expect(404);

    const customer = await send(app, 'post', '/api/v1/auth/register', undefined, {
      email: `customer-st-${suffix}@example.com`,
      password: 'customerpass123',
      name: 'Status Customer',
    }).expect(201);
    await send(app, 'patch', `/api/v1/admin/events/${eventId}/status`, customer.body.accessToken, {
      status: 'published',
    }).expect(403);
  });

  it('keeps the legacy verb endpoints working as aliases', async () => {
    await send(app, 'post', `/api/v1/events/${eventId}/unpublish`, adminToken, {}).expect(201);
    const detail = await send(app, 'get', `/api/v1/admin/events/${eventId}`, adminToken).expect(200);
    expect(detail.body.status).toBe('draft');
  });
});

describe('Admin order status endpoint validation and per-ticket cancel (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let buyerToken: string;
  let orderId: string;
  let ticketIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureTestApp(app);
    await app.init();

    adminToken = (
      await send(app, 'post', '/api/v1/auth/login', undefined, {
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
      }).expect(200)
    ).body.accessToken;
    buyerToken = (
      await send(app, 'post', '/api/v1/auth/register', undefined, {
        email: `buyer-st-${suffix}@example.com`,
        password: 'buyerpass123',
        name: 'Status Buyer',
      }).expect(201)
    ).body.accessToken;

    const category = await send(app, 'post', '/api/v1/categories', adminToken, {
      name: `E2E Status Order Cat ${suffix}`,
      slug: `e2e-status-order-cat-${suffix}`,
    }).expect(201);
    const organizer = await send(app, 'post', '/api/v1/organizers', adminToken, {
      name: `E2E Status Order Org ${suffix}`,
      slug: `e2e-status-order-org-${suffix}`,
    }).expect(201);
    const venue = await send(app, 'post', '/api/v1/venues', adminToken, {
      name: `E2E Status Order Hall ${suffix}`,
      city: 'Berlin',
      address: 'Orderstr. 9',
    }).expect(201);
    const event = await send(app, 'post', '/api/v1/events', adminToken, {
      name: `E2E Status Order ${suffix}`,
      categoryId: category.body.id,
      organizerId: organizer.body.id,
      venueId: venue.body.id,
      dateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).expect(201);
    await send(app, 'post', `/api/v1/events/${event.body.id}/publish`, adminToken).expect(201);
    const tt = await send(app, 'post', '/api/v1/ticket-types', adminToken, {
      eventId: event.body.id,
      name: 'GA',
      priceCents: 2000,
      quantity: 50,
    }).expect(201);

    await send(app, 'post', '/api/v1/cart/items', buyerToken, {
      ticketTypeId: tt.body.id,
      quantity: 2,
    }).expect(201);
    const checkout = await send(app, 'post', '/api/v1/checkout', buyerToken, {
      idempotencyKey: `st-e2e-${suffix}`,
    }).expect(201);
    orderId = checkout.body.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('validates the order status body and rejects junk extra keys', async () => {
    const pending = await send(app, 'patch', `/api/v1/admin/orders/${orderId}/status`, adminToken, {
      status: 'pending',
    }).expect(200);
    expect(pending.body.status).toBe('pending');

    await send(app, 'patch', `/api/v1/admin/orders/${orderId}/status`, adminToken, {
      status: 'confirmed',
    }).expect(200);

    for (const body of [{ status: 'nonsense' }, { status: 'confirmed', extraKey: 1 }]) {
      const res = await send(app, 'patch', `/api/v1/admin/orders/${orderId}/status`, adminToken, body).expect(400);
      expect(res.body.code).toBe('BAD_REQUEST');
    }
  });

  it('forwards refund/cancel to the dedicated flow and 404s unknown orders', async () => {
    for (const status of ['refunded', 'cancelled']) {
      const res = await send(app, 'patch', `/api/v1/admin/orders/${orderId}/status`, adminToken, {
        status,
      }).expect(409);
      expect(res.body.code).toBe('USE_DEDICATED_FLOW');
    }
    await send(app, 'patch', `/api/v1/admin/orders/${UNKNOWN_ID}/status`, adminToken, {
      status: 'pending',
    }).expect(404);
  });

  it('cancels a single valid ticket, refuses repeats, and leaves the sibling valid', async () => {
    const detail = await send(app, 'get', `/api/v1/admin/orders/${orderId}`, adminToken).expect(200);
    ticketIds = detail.body.items.flatMap((item: { tickets: { id: string }[] }) =>
      item.tickets.map((t: { id: string }) => t.id),
    );
    expect(ticketIds).toHaveLength(2);

    const cancelled = await send(app, 'post', `/api/v1/admin/tickets/${ticketIds[0]}/cancel`, adminToken).expect(201);
    expect(cancelled.body.status).toBe('cancelled');

    const after = await send(app, 'get', `/api/v1/admin/orders/${orderId}`, adminToken).expect(200);
    const statuses = new Map(
      after.body.items.flatMap((item: { tickets: { id: string; status: string }[] }) =>
        item.tickets.map((t) => [t.id, t.status]),
      ),
    );
    expect(statuses.get(ticketIds[0])).toBe('cancelled');
    expect(statuses.get(ticketIds[1])).toBe('valid');
  });

  it('409s on repeat cancel, 403s for customers, 404s unknown tickets, 409s after refund', async () => {
    const repeat = await send(app, 'post', `/api/v1/admin/tickets/${ticketIds[0]}/cancel`, adminToken).expect(409);
    expect(repeat.body.code).toBe('TICKET_NOT_CANCELLABLE');

    await send(app, 'post', `/api/v1/admin/tickets/${ticketIds[1]}/cancel`, buyerToken).expect(403);
    await send(app, 'post', `/api/v1/admin/tickets/${UNKNOWN_ID}/cancel`, adminToken).expect(404);

    await send(app, 'post', `/api/v1/admin/orders/${orderId}/refund`, adminToken).expect(201);
    const afterRefund = await send(app, 'post', `/api/v1/admin/tickets/${ticketIds[1]}/cancel`, adminToken).expect(409);
    expect(afterRefund.body.code).toBe('TICKET_NOT_CANCELLABLE');
  });
});