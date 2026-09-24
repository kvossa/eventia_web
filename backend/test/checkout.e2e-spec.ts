import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';

const suffix = `ck-${Date.now().toString(36)}`;
const ADMIN_EMAIL = 'root@eventia.local';
const ADMIN_PASSWORD = 'adminpass1234';
const USER_EMAIL = `e2e-${suffix}@example.com`;

function postJson(
  app: INestApplication<App>,
  path: string,
  body: object,
  token?: string,
) {
  let req = request(app.getHttpServer()).post(path).send(body);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  return req;
}

describe('Cart to checkout (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let userToken: string;
  let ticketTypeId: string;
  let orderId: string;
  let orderNumber: string;

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

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    adminToken = login.body.accessToken;

    const category = await postJson(app, '/api/v1/categories', {
      name: `E2E Cat ${suffix}`,
      slug: `e2e-cat-${suffix}`,
    }, adminToken).expect(201);
    const organizer = await postJson(app, '/api/v1/organizers', {
      name: `E2E Org ${suffix}`,
      slug: `e2e-org-${suffix}`,
    }, adminToken).expect(201);
    const venue = await postJson(app, '/api/v1/venues', {
      name: `E2E Arena ${suffix}`,
      city: 'Berlin',
      address: 'Teststr. 1',
    }, adminToken).expect(201);
    const event = await postJson(app, '/api/v1/events', {
      name: `E2E Event ${suffix}`,
      categoryId: category.body.id,
      organizerId: organizer.body.id,
      venueId: venue.body.id,
      dateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, adminToken).expect(201);
    await postJson(app, `/api/v1/events/${event.body.id}/publish`, {}, adminToken).expect(201);
    const tt = await postJson(app, '/api/v1/ticket-types', {
      eventId: event.body.id,
      name: 'Standard',
      priceCents: 1500,
      quantity: 50,
      maxPerCustomer: 4,
    }, adminToken).expect(201);
    ticketTypeId = tt.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers a user, checks out and issues tickets', async () => {
    const reg = await postJson(app, '/api/v1/auth/register', {
      email: USER_EMAIL,
      password: 'e2epass123',
      name: 'E2E User',
    }).expect(201);
    userToken = reg.body.accessToken;

    const cart = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(cart.body.items).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ ticketTypeId, quantity: 2 })
      .expect(201)
      .expect((res) => {
        expect(res.body.subtotalCents).toBe(3000);
      });

    const checkout = await request(app.getHttpServer())
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({})
      .expect(201);
    const order = checkout.body;
    expect(order.orderNumber).toMatch(/^EVT-\d{8}-[0-9A-F]{8}$/);
    expect(order.status).toBe('confirmed');
    expect(order.totalCents).toBe(3000);
    expect(order.payment.status).toBe('succeeded');
    expect(order.items[0].tickets).toHaveLength(2);
    expect(order.items[0].tickets[0].qrPayload).toContain('"v":1');
    orderId = order.id;
    orderNumber = order.orderNumber;

    const tickets = await request(app.getHttpServer())
      .get('/api/v1/tickets')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(tickets.body.total).toBe(2);
    expect(tickets.body.data[0].uniqueId).toMatch(/^TIX-/);
    expect(JSON.parse(tickets.body.data[0].qrPayload).t).toBe(tickets.body.data[0].uniqueId);

    const notifications = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);
    expect(notifications.body.unreadCount).toBeGreaterThanOrEqual(1);

    const empty = await request(app.getHttpServer())
      .post('/api/v1/checkout')
      .set('Authorization', `Bearer ${userToken}`)
      .send({})
      .expect(422);
    expect(empty.body.code).toBe('VALIDATION_ERROR');
  });

  it('admin order detail: customer 403 on admin route, admin fetches and refunds', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${orderId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/orders/${orderId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.orderNumber).toBe(orderNumber);
    expect(detail.body.items[0].tickets).toHaveLength(2);

    const refunded = await request(app.getHttpServer())
      .post(`/api/v1/admin/orders/${orderId}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(refunded.body.status).toBe('refunded');
    expect(refunded.body.payment.status).toBe('refunded');
    expect(refunded.body.items[0].tickets[0].status).toBe('refunded');
  });
});