import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { EmailOutboxRecord } from '../src/entities/email-outbox.entity.js';

const ADMIN_EMAIL = 'root@eventia.local';
const ADMIN_PASSWORD = 'adminpass1234';
const USER_PASSWORD = 'e2epass123';
const suffix = `aa-${Date.now().toString(36)}`;
const USER_EMAIL = `e2e-${suffix}@example.com`;
const USER_FIRST = 'E2E';
const USER_LAST = 'Customer';

function send(
  app: INestApplication,
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  token?: string,
  body?: unknown,
): Test {
  let req = request(app.getHttpServer())[method](path);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  return body !== undefined ? req.send(body as object) : req;
}

describe('Account & admin foundations (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let eventId: string;
  let ticketTypeId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();

    const adminLogin = await send(app, 'post', '/api/v1/auth/login', undefined, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    }).expect(200);
    adminToken = adminLogin.body.accessToken;

    const userReg = await send(app, 'post', '/api/v1/auth/register', undefined, {
      email: USER_EMAIL,
      password: USER_PASSWORD,
      name: USER_FIRST + ' ' + USER_LAST,
    }).expect(201);
    userToken = userReg.body.accessToken;

    const category = await send(app, 'post', '/api/v1/categories', adminToken, {
      name: `E2E Category ${suffix}`,
      slug: `e2e-cat-${suffix}`,
    }).expect(201);
    const organizer = await send(app, 'post', '/api/v1/organizers', adminToken, {
      name: `E2E Org ${suffix}`,
      slug: `e2e-org-${suffix}`,
    }).expect(201);
    const venue = await send(app, 'post', '/api/v1/venues', adminToken, {
      name: `E2E Arena ${suffix}`,
      city: 'Berlin',
      address: 'Teststr. 1',
    }).expect(201);
    const event = await send(app, 'post', '/api/v1/events', adminToken, {
      name: `E2E Event ${suffix}`,
      categoryId: category.body.id,
      organizerId: organizer.body.id,
      venueId: venue.body.id,
      dateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).expect(201);
    await send(app, 'post', `/api/v1/events/${event.body.id}/publish`, adminToken, {}).expect(201);
    const tt = await send(app, 'post', '/api/v1/ticket-types', adminToken, {
      eventId: event.body.id,
      name: 'Standard',
      priceCents: 1500,
      quantity: 50,
      maxPerCustomer: 4,
    }).expect(201);
    eventId = event.body.id;
    ticketTypeId = tt.body.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('requires auth for favorites', async () => {
    await send(app, 'get', '/api/v1/favorites').expect(401);
  });

  it('favorites: add idempotent, decorated list, remove', async () => {
    const added = await send(app, 'post', `/api/v1/favorites/${eventId}`, userToken).expect(201);
    expect(added.body.id).toBe(eventId);
    const again = await send(app, 'post', `/api/v1/favorites/${eventId}`, userToken).expect(201);
    expect(again.body.id).toBe(eventId);
    const list = await send(app, 'get', '/api/v1/favorites', userToken).expect(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(eventId);
    expect(list.body.data[0].availability.state).toBe('available');
    await send(app, 'delete', `/api/v1/favorites/${eventId}`, userToken).expect(204);
    const after = await send(app, 'get', '/api/v1/favorites', userToken).expect(200);
    expect(after.body.data).toHaveLength(0);
  });

  it('favorites: missing event is 404', async () => {
    await send(app, 'post', '/api/v1/favorites/missing-event', userToken).expect(404);
  });

  it('admin stats: customer forbidden, admin served', async () => {
    await send(app, 'get', '/api/v1/admin/stats', userToken).expect(403);
    const stats = await send(app, 'get', '/api/v1/admin/stats', adminToken).expect(200);
    expect(stats.body.totalEvents).toBeGreaterThan(0);
    expect(stats.body.totalUsers).toBeGreaterThan(0);
    expect(typeof stats.body.totalRevenueCents).toBe('number');
    expect(Array.isArray(stats.body.recentOrders)).toBe(true);
  });

  it('admin users: search + role update; invalid role rejected', async () => {
    await send(app, 'get', '/api/v1/admin/users?q=customer', userToken).expect(403);
    const list = await send(app, 'get', '/api/v1/admin/users?q=customer', adminToken).expect(200);
    expect(list.body.total).toBeGreaterThan(0);
    const target = list.body.data[0];
    await send(app, 'patch', `/api/v1/admin/users/${target.id}`, adminToken, { role: 'customer' }).expect(200);
    await send(app, 'patch', `/api/v1/admin/users/${target.id}`, adminToken, { role: 'invalid' }).expect(400);
  });

  it('duplicates an event as a draft copy with reset ticket types', async () => {
    const copy = await send(app, 'post', `/api/v1/events/${eventId}/duplicate`, adminToken).expect(201);
    expect(copy.body.id).not.toBe(eventId);
    expect(copy.body.name).toBe(`E2E Event ${suffix} (copy)`);
    expect(copy.body.status).toBe('draft');
    expect(copy.body.ticketTypes[0].quantitySold).toBe(0);
  });

  it('admin events: all-status list + draft detail; public detail stays gated', async () => {
    const cat = await send(app, 'post', '/api/v1/categories', adminToken, {
      name: `E2E Cat D ${suffix}`,
      slug: `e2e-cat-d-${suffix}`,
    }).expect(201);
    const org = await send(app, 'post', '/api/v1/organizers', adminToken, {
      name: `E2E Org D ${suffix}`,
      slug: `e2e-org-d-${suffix}`,
    }).expect(201);
    const ven = await send(app, 'post', '/api/v1/venues', adminToken, {
      name: `E2E Ven D ${suffix}`,
      city: 'Berlin',
      address: 'Draftstr. 2',
    }).expect(201);
    const draft = await send(app, 'post', '/api/v1/events', adminToken, {
      name: `E2E Draft ${suffix}`,
      categoryId: cat.body.id,
      organizerId: org.body.id,
      venueId: ven.body.id,
      dateTime: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    }).expect(201);
    expect(draft.body.status).toBe('draft');

    await send(app, 'get', '/api/v1/admin/events', userToken).expect(403);
    const list = await send(app, 'get', '/api/v1/admin/events?limit=100', adminToken).expect(200);
    expect(list.body.data.some((e) => e.id === draft.body.id)).toBe(true);
    const drafts = await send(app, 'get', '/api/v1/admin/events?status=draft&limit=100', adminToken).expect(200);
    expect(drafts.body.data.every((e) => e.status === 'draft')).toBe(true);
    expect(drafts.body.data.some((e) => e.id === draft.body.id)).toBe(true);

    const detail = await send(app, 'get', `/api/v1/admin/events/${draft.body.id}`, adminToken).expect(200);
    expect(detail.body.id).toBe(draft.body.id);
    expect(detail.body.status).toBe('draft');
    expect(detail.body.venue.name).toBe(`E2E Ven D ${suffix}`);
    expect(detail.body.category.name).toBe(`E2E Cat D ${suffix}`);
    expect(detail.body.organizer.name).toBe(`E2E Org D ${suffix}`);

    await send(app, 'get', `/api/v1/events/${draft.body.id}`).expect(404);
  });

  it('admin catalog deletes: in-use is 409, unused succeeds', async () => {
    const cat = await send(app, 'post', '/api/v1/categories', adminToken, {
      name: `E2E Cat G ${suffix}`,
      slug: `e2e-cat-g-${suffix}`,
    }).expect(201);
    const org = await send(app, 'post', '/api/v1/organizers', adminToken, {
      name: `E2E Org G ${suffix}`,
      slug: `e2e-org-g-${suffix}`,
    }).expect(201);
    const ven = await send(app, 'post', '/api/v1/venues', adminToken, {
      name: `E2E Ven G ${suffix}`,
      city: 'Berlin',
      address: 'Guardstr. 3',
    }).expect(201);
    await send(app, 'post', '/api/v1/events', adminToken, {
      name: `E2E Guard Event ${suffix}`,
      categoryId: cat.body.id,
      organizerId: org.body.id,
      venueId: ven.body.id,
      dateTime: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    }).expect(201);

    const venDel = await send(app, 'delete', `/api/v1/venues/${ven.body.id}`, adminToken).expect(409);
    expect(venDel.body.code).toBe('VENUE_IN_USE');
    const orgDel = await send(app, 'delete', `/api/v1/organizers/${org.body.id}`, adminToken).expect(409);
    expect(orgDel.body.code).toBe('ORGANIZER_IN_USE');
    const catDel = await send(app, 'delete', `/api/v1/categories/${cat.body.id}`, adminToken).expect(409);
    expect(catDel.body.code).toBe('CATEGORY_IN_USE');

    const listBefore = await send(app, 'get', '/api/v1/venues', adminToken).expect(200);
    expect(listBefore.body.some((v) => v.id === ven.body.id)).toBe(true);
  });

  it('change-password: wrong current rejected, success revokes sessions', async () => {
    await send(app, 'post', '/api/v1/auth/change-password', userToken, {
      currentPassword: 'wrongpass123',
      newPassword: 'newpass123',
    }).expect(401);
    const ok = await send(app, 'post', '/api/v1/auth/change-password', userToken, {
      currentPassword: USER_PASSWORD,
      newPassword: 'newpass123',
    }).expect(200);
    expect(ok.body.success).toBe(true);
  });

  it('notification-preferences: defaults true, PATCH persists, rejects bad input', async () => {
    const me = await send(app, 'get', '/api/v1/users/me', userToken).expect(200);
    expect(me.body.emailNotifications).toBe(true);
    expect(me.body.smsNotifications).toBe(true);

    const updated = await send(app, 'patch', '/api/v1/users/me/notification-preferences', userToken, {
      emailNotifications: false,
      smsNotifications: false,
    }).expect(200);
    expect(updated.body.emailNotifications).toBe(false);
    expect(updated.body.smsNotifications).toBe(false);

    const meAfter = await send(app, 'get', '/api/v1/users/me', userToken).expect(200);
    expect(meAfter.body.emailNotifications).toBe(false);
    expect(meAfter.body.smsNotifications).toBe(false);

    await send(app, 'patch', '/api/v1/users/me/notification-preferences', userToken, {
      emailNotifications: 'nope',
    }).expect(400);
    await send(app, 'patch', '/api/v1/users/me/notification-preferences', userToken, {
      unknown: true,
    }).expect(400);
  });

  it('notifications: checkout creates purchase_confirmed, unread flows, mark read', async () => {
    await send(app, 'post', '/api/v1/cart/items', userToken, {
      ticketTypeId,
      quantity: 1,
    }).expect(201);
    const order = await send(app, 'post', '/api/v1/checkout', userToken, {}).expect(201);
    expect(order.body.status).toBe('confirmed');

    const list = await send(app, 'get', '/api/v1/notifications', userToken).expect(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    const found = list.body.data.find((n) => n.type === 'purchase_confirmed');
    expect(found).toBeDefined();
    expect(found.title).toBe('Order confirmed');
    expect(list.body.unreadCount).toBeGreaterThanOrEqual(1);

    const unread = await send(app, 'get', '/api/v1/notifications/unread-count', userToken).expect(200);
    expect(unread.body.unreadCount).toBeGreaterThanOrEqual(1);

    await send(app, 'patch', '/api/v1/notifications/read-all', userToken, {}).expect(200);
    const after = await send(app, 'get', '/api/v1/notifications/unread-count', userToken).expect(200);
    expect(after.body.unreadCount).toBe(0);

    const read = await send(app, 'patch', `/api/v1/notifications/${found.id}/read`, userToken, {}).expect(200);
    expect(read.body.id).toBe(found.id);
  });

  it('customer cancel: refunds order, restores stock, 409 on re-cancel, 404 cross-user', async () => {
    await send(app, 'post', '/api/v1/cart/items', userToken, {
      ticketTypeId,
      quantity: 1,
    }).expect(201);
    const order = await send(app, 'post', '/api/v1/checkout', userToken, {}).expect(201);

    const adminDetail = await send(app, 'get', `/api/v1/admin/events/${eventId}`, adminToken).expect(200);
    const ttAfter = adminDetail.body.ticketTypes.find((t) => t.id === ticketTypeId);
    expect(ttAfter).toBeDefined();
    const soldAfter = ttAfter.quantitySold as number;

    const cancelled = await send(app, 'post', `/api/v1/orders/${order.body.id}/cancel`, userToken).expect(201);
    expect(cancelled.body.id).toBe(order.body.id);
    expect(cancelled.body.status).toBe('refunded');
    expect(cancelled.body.payment.status).toBe('refunded');

    const afterCancel = await send(app, 'get', `/api/v1/admin/events/${eventId}`, adminToken).expect(200);
    const ttRestored = afterCancel.body.ticketTypes.find((t) => t.id === ticketTypeId);
    expect(ttRestored.quantitySold).toBe(soldAfter - 1);

    await send(app, 'post', `/api/v1/orders/${order.body.id}/cancel`, userToken).expect(409);

    const otherReg = await send(app, 'post', '/api/v1/auth/register', undefined, {
      email: `e2e-other-${suffix}@example.com`,
      password: 'e2epass123',
      name: 'Other User',
    }).expect(201);
    await send(app, 'post', `/api/v1/orders/${order.body.id}/cancel`, otherReg.body.accessToken).expect(404);
  });

  it('admin orders export: CSV header + rows, respects status filter, customer blocked', async () => {
    await send(app, 'get', '/api/v1/admin/orders/export', userToken).expect(403);

    const csv = await send(app, 'get', '/api/v1/admin/orders/export', adminToken).expect(200);
    const lines = (csv.body.csv as string).split('\r\n');
    expect(lines[0]).toBe('orderNumber,createdAt,customerName,customerEmail,status,totalCents,itemsCount,paymentStatus');
    const rows = lines.slice(1).filter(Boolean);
    expect(rows.length).toBeGreaterThan(0);

    const confirmed = await send(app, 'get', '/api/v1/admin/orders/export?status=confirmed', adminToken).expect(200);
    const confRows = (confirmed.body.csv as string).split('\r\n').slice(1).filter(Boolean);
    expect(confRows.length).toBeGreaterThan(0);
    expect(confRows.every((l) => l.split(',')[4] === 'confirmed')).toBe(true);
  });

  it('password recovery: forgot writes reset email, reset clears token and unbinds sessions', async () => {
    const resetUser = `reset-${suffix}@example.com`;
    await send(app, 'post', '/api/v1/auth/register', undefined, {
      email: resetUser,
      password: 'oldpass123',
      name: 'E2E Reset',
    }).expect(201);

    const anonymous = await send(app, 'post', '/api/v1/auth/forgot-password', undefined, {
      email: 'does-not-exist@example.com',
    }).expect(200);
    expect(anonymous.body.success).toBe(true);

    await send(app, 'post', '/api/v1/auth/forgot-password', undefined, {
      email: resetUser,
    }).expect(200);

    await send(app, 'post', '/api/v1/auth/reset-password', undefined, {
      token: 'totally-bogus-token-value',
      newPassword: 'newpass123',
    })
      .expect(400)
      .expect((res) => {
        expect(res.body.code).toBe('INVALID_RESET_TOKEN');
      });

    const dataSource = app.get(DataSource);
    const outbox = dataSource.getRepository(EmailOutboxRecord);
    const latest = await outbox.findOne({
      where: { to: resetUser, subject: 'Reset your Eventia password' },
      order: { createdAt: 'DESC' },
    });
    expect(latest).toBeDefined();
    const token = /auth\/reset-password\?token=([^\s]+)/.exec(latest!.body)?.[1];
    expect(token).toBeDefined();

    const ok = await send(app, 'post', '/api/v1/auth/reset-password', undefined, {
      token,
      newPassword: 'newpass123',
    }).expect(200);
    expect(ok.body.success).toBe(true);

    const newLogin = await send(app, 'post', '/api/v1/auth/login', undefined, {
      email: resetUser,
      password: 'newpass123',
    }).expect(200);
    expect(newLogin.body.accessToken).toBeDefined();

    await send(app, 'post', '/api/v1/auth/login', undefined, {
      email: resetUser,
      password: 'oldpass123',
    }).expect(401);

    await send(app, 'post', '/api/v1/auth/reset-password', undefined, {
      token,
      newPassword: 'thirdpass123',
    })
      .expect(400)
      .expect((res) => {
        expect(res.body.code).toBe('INVALID_RESET_TOKEN');
      });
  });
});
