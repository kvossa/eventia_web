import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { configureTestApp } from './test-app.helper.js';

const suffix = `cm-${Date.now().toString(36)}`;
const ADMIN_EMAIL = 'root@eventia.local';
const ADMIN_PASSWORD = 'adminpass1234';

describe('Guest cart survives registration (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let ticketTypeId: string;
  let eventId: string;

  const register = (label: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `e2e-${label}-${suffix}@example.com`,
        password: 'probepass123',
        name: `E2E ${label}`,
      });

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureTestApp(app);
    await app.init();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200);
    adminToken = login.body.accessToken;

    const category = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `E2E Cat ${suffix}`, slug: `e2e-cat-${suffix}` })
      .expect(201);
    const organizer = await request(app.getHttpServer())
      .post('/api/v1/organizers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `E2E Org ${suffix}`, slug: `e2e-org-${suffix}` })
      .expect(201);
    const venue = await request(app.getHttpServer())
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `E2E Arena ${suffix}`, city: 'Berlin', address: 'Teststr. 1' })
      .expect(201);

    const event = await request(app.getHttpServer())
      .post('/api/v1/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `E2E Event ${suffix}`,
        categoryId: category.body.id,
        organizerId: organizer.body.id,
        venueId: venue.body.id,
        dateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .expect(201);
    eventId = event.body.id;
    await request(app.getHttpServer())
      .post(`/api/v1/events/${eventId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);

    const ticketType = await request(app.getHttpServer())
      .post('/api/v1/ticket-types')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ eventId, name: 'GA', priceCents: 2500, quantity: 100, maxPerCustomer: 4 })
      .expect(201);
    ticketTypeId = ticketType.body.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('keeps visitor items and re-owns them when the visitor registers', async () => {
    const added = await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .send({ ticketTypeId, quantity: 2 })
      .expect(201);
    expect(added.body.items).toHaveLength(1);
    expect(added.body.items[0].quantity).toBe(2);
    expect(added.body.userId).toBeNull();

    const guestCartCookie = added.headers['set-cookie'].find((c: string) => c.startsWith('eventia_cart='));
    expect(guestCartCookie).toBeDefined();

    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Cookie', guestCartCookie.split(';')[0])
      .send({ email: `e2e-visitor-${suffix}@example.com`, password: 'probepass123', name: 'E2E Visitor' })
      .expect(201);

    const ownerCookie = registered.headers['set-cookie'].find((c: string) => c.startsWith('eventia_cart='));
    expect(ownerCookie).toBeDefined();
    expect(ownerCookie.split(';')[0]).not.toBe(guestCartCookie.split(';')[0]);

    const merged = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Cookie', ownerCookie.split(';')[0])
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
      .expect(200);
    expect(merged.body.items).toHaveLength(1);
    expect(merged.body.items[0].quantity).toBe(2);
    expect(merged.body.userId).toBe(registered.body.user.id);
  });

  it('logout clears the cart cookie so the next visitor cannot inherit the previous account cart', async () => {
    const owner = await register('cartowner').expect(201);
    const ownerCartCookie = owner.headers['set-cookie'].find((c: string) => c.startsWith('eventia_cart='));
    expect(ownerCartCookie).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Cookie', ownerCartCookie.split(';')[0])
      .send({ ticketTypeId, quantity: 2 })
      .expect(201);

    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', ownerCartCookie.split(';')[0])
      .send({})
      .expect(200);

    const cleared = logout.headers['set-cookie'].filter((c: string) => c.startsWith('eventia_cart='));
    expect(cleared.length).toBeGreaterThan(0);
    expect(cleared.every((c: string) => /(Max-Age=0|Expires=Thu, 01 Jan 1970)/.test(c))).toBe(true);
  });

  it('a cart cookie belonging to another account is not reused for a guest cart', async () => {
    const owner = await register('staleowner').expect(201);
    const ownerCartCookie = owner.headers['set-cookie'].find((c: string) => c.startsWith('eventia_cart='));
    const ownerCart = ownerCartCookie.split(';')[0];

    const ownerCartRef = ownerCart.slice('eventia_cart='.length);
    const before = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Cookie', ownerCart)
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .expect(200);
    expect(before.body.items).toHaveLength(0);

    const guestAdd = await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Cookie', ownerCart)
      .send({ ticketTypeId, quantity: 2 })
      .expect(201);
    const guestCookie = guestAdd.headers['set-cookie'].find((c: string) => c.startsWith('eventia_cart='));

    expect(guestAdd.body.userId).toBeNull();
    expect(guestCookie).toBeDefined();
    expect(guestCookie.split(';')[0]).not.toBe(ownerCart);

    const ownerAfter = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Cookie', ownerCart)
      .set('Authorization', `Bearer ${owner.body.accessToken}`)
      .expect(200);
    expect(ownerAfter.body.id).toBe(ownerCartRef);
    expect(ownerAfter.body.items).toHaveLength(0);
  });

  it('visitor items still merge after the browser cookie was cleared by logout', async () => {
    const owner = await register('flowowner').expect(201);
    const ownerCartCookie = owner.headers['set-cookie'].find((c: string) => c.startsWith('eventia_cart='));
    const ownerCart = ownerCartCookie.split(';')[0];

    await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .set('Cookie', ownerCart)
      .send({ ticketTypeId, quantity: 2 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', ownerCart)
      .send({})
      .expect(200);

    const guestAdd = await request(app.getHttpServer())
      .post('/api/v1/cart/items')
      .send({ ticketTypeId, quantity: 2 })
      .expect(201);
    const guestCartCookie = guestAdd.headers['set-cookie'].find((c: string) => c.startsWith('eventia_cart='));
    expect(guestAdd.body.userId).toBeNull();
    expect(guestAdd.body.items).toHaveLength(1);

    const newcomer = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .set('Cookie', guestCartCookie.split(';')[0])
      .send({ email: `e2e-newcomer-${suffix}@example.com`, password: 'probepass123', name: 'E2E Newcomer' })
      .expect(201);
    const newcomerCookie = newcomer.headers['set-cookie'].find((c: string) => c.startsWith('eventia_cart='));
    expect(newcomerCookie).toBeDefined();

    const cart = await request(app.getHttpServer())
      .get('/api/v1/cart')
      .set('Cookie', newcomerCookie.split(';')[0])
      .set('Authorization', `Bearer ${newcomer.body.accessToken}`)
      .expect(200);

    expect(cart.body.userId).toBe(newcomer.body.user.id);
    expect(cart.body.items).toHaveLength(1);
    expect(cart.body.items[0].quantity).toBe(2);
  });
});
