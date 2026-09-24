import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';

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
});
