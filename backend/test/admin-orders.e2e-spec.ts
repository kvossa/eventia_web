import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureTestApp } from './test-app.helper.js';

const ADMIN_EMAIL = 'root@eventia.local';
const ADMIN_PASSWORD = 'adminpass1234';
const suffix = `adm-${Date.now().toString(36)}`;

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

describe('Admin orders date filter and dashboard tickets sold (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;
  let orderId: string;
  let orderNumber: string;
  const today = new Date().toISOString().slice(0, 10);

  let statsBefore: { ticketsSold: number; totalRevenueCents: number };

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
      email: `buyer2-${suffix}@example.com`,
      password: 'buyer2pass123',
      name: 'Order Buyer',
    }).expect(201);
    userToken = user.body.accessToken;

    const category = await send(app, 'post', '/api/v1/categories', adminToken, {
      name: `E2E Adm Cat ${suffix}`,
      slug: `e2e-adm-cat-${suffix}`,
    }).expect(201);
    const organizer = await send(app, 'post', '/api/v1/organizers', adminToken, {
      name: `E2E Adm Org ${suffix}`,
      slug: `e2e-adm-org-${suffix}`,
    }).expect(201);
    const venueId = (
      await send(app, 'post', '/api/v1/venues', adminToken, {
        name: `E2E Adm Arena ${suffix}`,
        city: 'Berlin',
        address: 'Admstr. 1',
      }).expect(201)
    ).body.id;
    const event = await send(app, 'post', '/api/v1/events', adminToken, {
      name: `E2E Adm Event ${suffix}`,
      categoryId: category.body.id,
      organizerId: organizer.body.id,
      venueId,
      dateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).expect(201);
    await send(app, 'post', `/api/v1/events/${event.body.id}/publish`, adminToken).expect(201);
    const tt = await send(app, 'post', '/api/v1/ticket-types', adminToken, {
      eventId: event.body.id,
      name: 'GA',
      priceCents: 1500,
      quantity: 50,
    }).expect(201);

    statsBefore = (await send(app, 'get', '/api/v1/admin/stats', adminToken).expect(200)).body;

    await send(app, 'post', '/api/v1/cart/items', userToken, {
      ticketTypeId: tt.body.id,
      quantity: 2,
    }).expect(201);
    const checkout = await send(app, 'post', '/api/v1/checkout', userToken, {
      idempotencyKey: `adm-e2e-${suffix}`,
    }).expect(201);
    orderId = checkout.body.id;
    orderNumber = checkout.body.orderNumber;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('a date-only "to" filter includes every order from the final day', async () => {
    const list = await send(app, 'get', `/api/v1/admin/orders?to=${today}`, adminToken).expect(200);
    const numbers = list.body.data.map((o: { orderNumber: string }) => o.orderNumber);
    expect(numbers).toContain(orderNumber);
  });

  it('treats from=to=today as the whole day in the CSV export too', async () => {
    const csv = await send(
      app,
      'get',
      `/api/v1/admin/orders/export?from=${today}&to=${today}`,
      adminToken,
    ).expect(200);
    expect(csv.body.csv).toContain(orderNumber);
  });

  it('dashboard tickets sold and revenue agree after a refund', async () => {
    const afterBuy = (await send(app, 'get', '/api/v1/admin/stats', adminToken).expect(200)).body;
    expect(afterBuy.ticketsSold).toBe(statsBefore.ticketsSold + 2);
    expect(afterBuy.totalRevenueCents).toBe(statsBefore.totalRevenueCents + 3000);

    await send(app, 'post', `/api/v1/admin/orders/${orderId}/refund`, adminToken).expect(201);
    const afterRefund = (await send(app, 'get', '/api/v1/admin/stats', adminToken).expect(200)).body;
    expect(afterRefund.ticketsSold).toBe(statsBefore.ticketsSold);
    expect(afterRefund.totalRevenueCents).toBe(statsBefore.totalRevenueCents);
  });
});