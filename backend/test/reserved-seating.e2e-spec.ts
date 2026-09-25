import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';

const ADMIN_EMAIL = 'root@eventia.local';
const ADMIN_PASSWORD = 'adminpass1234';
const suffix = `rsv-${Date.now().toString(36)}`;

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

function send(
  app: INestApplication,
  method: Method,
  path: string,
  token?: string,
  body?: unknown,
): Test {
  let req = request(app.getHttpServer())[method](path);
  if (token) req = req.set('Authorization', `Bearer ${token}`);
  return body !== undefined ? req.send(body as object) : req;
}

describe('Reserved seating (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let aliceToken: string;
  let bobToken: string;
  let floorId: string;
  let balconyId: string;
  let floorSeats: string[];
  let balconySeat: string;
  let reservedEventId: string;
  let premiumId: string;
  let upperId: string;
  let reserved2EventId: string;
  let reserved2TtId: string;
  let generalTtId: string;
  let bobOrderId: string;

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

    const alice = await send(app, 'post', '/api/v1/auth/register', undefined, {
      email: `alice-${suffix}@example.com`,
      password: 'alicepass123',
      name: 'Reserved Alice',
    }).expect(201);
    aliceToken = alice.body.accessToken;

    const bob = await send(app, 'post', '/api/v1/auth/register', undefined, {
      email: `bob-${suffix}@example.com`,
      password: 'bobpass123',
      name: 'Reserved Bob',
    }).expect(201);
    bobToken = bob.body.accessToken;

    const category = await send(app, 'post', '/api/v1/categories', adminToken, {
      name: `E2E Rsv Cat ${suffix}`,
      slug: `e2e-rsv-cat-${suffix}`,
    }).expect(201);
    const organizer = await send(app, 'post', '/api/v1/organizers', adminToken, {
      name: `E2E Rsv Org ${suffix}`,
      slug: `e2e-rsv-org-${suffix}`,
    }).expect(201);

    const venueId = (
      await send(app, 'post', '/api/v1/venues', adminToken, {
        name: `E2E Reserved Arena ${suffix}`,
        city: 'Berlin',
        address: 'Reservedstr. 1',
      }).expect(201)
    ).body.id;

    const floor = await send(app, 'post', `/api/v1/admin/venues/${venueId}/sections`, adminToken, {
      name: 'Floor',
      sortOrder: 0,
    }).expect(201);
    floorId = floor.body.id;
    await send(app, 'post', `/api/v1/admin/venues/sections/${floorId}/rows`, adminToken, {
      label: 'A',
      seatCount: 3,
      accessibleNumbers: [1],
    }).expect(201);

    const balcony = await send(app, 'post', `/api/v1/admin/venues/${venueId}/sections`, adminToken, {
      name: 'Balcony',
    }).expect(201);
    balconyId = balcony.body.id;
    await send(app, 'post', `/api/v1/admin/venues/sections/${balconyId}/rows`, adminToken, {
      label: '1',
      seatCount: 2,
    }).expect(201);

    const layout = await send(app, 'get', `/api/v1/venues/${venueId}/layout`).expect(200);
    floorSeats = layout.body.sections
      .find((section: { id: string }) => section.id === floorId)
      .rows[0].seats.map((seat: { id: string }) => seat.id);
    balconySeat = layout.body.sections
      .find((section: { id: string }) => section.id === balconyId)
      .rows[0].seats[0].id;

    const event = await send(app, 'post', '/api/v1/events', adminToken, {
      name: `E2E Reserved ${suffix}`,
      categoryId: category.body.id,
      organizerId: organizer.body.id,
      venueId,
      dateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      reservedSeating: true,
    }).expect(201);
    reservedEventId = event.body.id;
    expect(event.body.reservedSeating).toBe(true);
    await send(app, 'post', `/api/v1/events/${reservedEventId}/publish`, adminToken).expect(201);

    const premium = await send(app, 'post', '/api/v1/ticket-types', adminToken, {
      eventId: reservedEventId,
      name: 'Premium',
      priceCents: 4000,
      quantity: 50,
      maxPerCustomer: 4,
    }).expect(201);
    premiumId = premium.body.id;
    await send(app, 'put', `/api/v1/ticket-types/${premiumId}/sections`, adminToken, {
      sectionIds: [floorId],
    }).expect(200);

    const upper = await send(app, 'post', '/api/v1/ticket-types', adminToken, {
      eventId: reservedEventId,
      name: 'Upper',
      priceCents: 2000,
      quantity: 50,
      maxPerCustomer: 4,
    }).expect(201);
    upperId = upper.body.id;
    await send(app, 'put', `/api/v1/ticket-types/${upperId}/sections`, adminToken, {
      sectionIds: [balconyId],
    }).expect(200);

    const event2 = await send(app, 'post', '/api/v1/events', adminToken, {
      name: `E2E Reserved2 ${suffix}`,
      categoryId: category.body.id,
      organizerId: organizer.body.id,
      venueId,
      dateTime: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      reservedSeating: true,
    }).expect(201);
    reserved2EventId = event2.body.id;
    await send(app, 'post', `/api/v1/events/${reserved2EventId}/publish`, adminToken).expect(201);
    const tt2 = await send(app, 'post', '/api/v1/ticket-types', adminToken, {
      eventId: reserved2EventId,
      name: 'Floor Pass',
      priceCents: 3000,
      quantity: 50,
      maxPerCustomer: 4,
    }).expect(201);
    reserved2TtId = tt2.body.id;
    await send(app, 'put', `/api/v1/ticket-types/${reserved2TtId}/sections`, adminToken, {
      sectionIds: [floorId],
    }).expect(200);

    const generalVenueId = (
      await send(app, 'post', '/api/v1/venues', adminToken, {
        name: `E2E General Arena ${suffix}`,
        city: 'Berlin',
        address: 'Generalstr. 1',
      }).expect(201)
    ).body.id;
    const generalEvent = await send(app, 'post', '/api/v1/events', adminToken, {
      name: `E2E General Rsv ${suffix}`,
      categoryId: category.body.id,
      organizerId: organizer.body.id,
      venueId: generalVenueId,
      dateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }).expect(201);
    await send(app, 'post', `/api/v1/events/${generalEvent.body.id}/publish`, adminToken).expect(201);
    const generalTt = await send(app, 'post', '/api/v1/ticket-types', adminToken, {
      eventId: generalEvent.body.id,
      name: 'General',
      priceCents: 1000,
      quantity: 50,
    }).expect(201);
    generalTtId = generalTt.body.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('serves the public seat map and enforces reserved/general seat rules', async () => {
    const seatMap = await send(app, 'get', `/api/v1/events/${reservedEventId}/seat-map`).expect(200);
    expect(seatMap.body.ticketTypes.map((tt: { id: string }) => tt.id)).toEqual([upperId, premiumId]);
    const floor = seatMap.body.sections.find((section: { name: string }) => section.name === 'Floor');
    expect(floor.rows[0].label).toBe('A');
    expect(floor.rows[0].seats).toHaveLength(3);
    expect(floor.rows[0].seats[0].isAccessible).toBe(true);
    expect(floor.rows[0].seats.every((seat: { occupied: boolean }) => seat.occupied === false)).toBe(true);

    const seatMap2 = await send(app, 'get', `/api/v1/events/${reserved2EventId}/seat-map`).expect(200);
    expect(seatMap2.body.sections.map((section: { name: string }) => section.name).sort()).toEqual([
      'Balcony',
      'Floor',
    ]);
    const floorPass = seatMap2.body.ticketTypes.find((tt: { id: string }) => tt.id === reserved2TtId);
    expect(floorPass.sectionIds).toEqual([floorId]);

    await send(app, 'post', '/api/v1/cart/items', aliceToken, {
      ticketTypeId: generalTtId,
      quantity: 1,
      seatIds: [floorSeats[0]],
    })
      .expect(400)
      .expect((res) => {
        expect(res.body.code).toBe('SEATS_NOT_APPLICABLE');
      });

    await send(app, 'post', '/api/v1/cart/items', aliceToken, {
      ticketTypeId: premiumId,
      quantity: 1,
    })
      .expect(400)
      .expect((res) => {
        expect(res.body.code).toBe('SEATS_REQUIRED');
      });

    await send(app, 'post', '/api/v1/cart/items', aliceToken, {
      ticketTypeId: premiumId,
      quantity: 1,
      seatIds: ['00000000-0000-4000-8000-000000000000'],
    })
      .expect(404)
      .expect((res) => {
        expect(res.body.code).toBe('SEAT_NOT_FOUND');
      });

    await send(app, 'post', '/api/v1/cart/items', aliceToken, {
      ticketTypeId: premiumId,
      quantity: 1,
      seatIds: [balconySeat],
    })
      .expect(422)
      .expect((res) => {
        expect(res.body.code).toBe('SEAT_NOT_IN_TICKET_TYPE');
      });
  });

  it('checkout issues one ticket per seat with labels and skips quantitySold', async () => {
    const added = await send(app, 'post', '/api/v1/cart/items', aliceToken, {
      ticketTypeId: premiumId,
      quantity: 2,
      seatIds: [floorSeats[1], floorSeats[2]],
    }).expect(201);
    expect(added.body.subtotalCents).toBe(8000);
    expect(added.body.items[0].quantity).toBe(2);
    expect(added.body.items[0].seats).toHaveLength(2);

    await send(app, 'patch', `/api/v1/cart/items/${added.body.items[0].id}`, aliceToken, {
      quantity: 1,
    })
      .expect(409)
      .expect((res) => {
        expect(res.body.code).toBe('RESERVED_SEATS_FIXED');
      });

    await send(app, 'delete', `/api/v1/cart/items/${added.body.items[0].id}`, aliceToken).expect(200);
    await send(app, 'post', '/api/v1/cart/items', aliceToken, {
      ticketTypeId: premiumId,
      quantity: 2,
      seatIds: [floorSeats[1], floorSeats[2]],
    }).expect(201);

    const key = `rsv-e2e-${suffix}-alice`;
    const checkout = await send(app, 'post', '/api/v1/checkout', aliceToken, {
      idempotencyKey: key,
    }).expect(201);
    const order = checkout.body;
    expect(order.totalCents).toBe(8000);
    expect(order.items[0].tickets).toHaveLength(2);
    expect(order.items[0].tickets.map((t: { seatLabel: string }) => t.seatLabel).sort()).toEqual([
      'Floor \u00b7 A \u00b7 2',
      'Floor \u00b7 A \u00b7 3',
    ]);
    expect(JSON.parse(order.items[0].tickets[0].qrPayload).s).toMatch(/^Floor \u00b7 A \u00b7 \d$/);

    const retry = await send(app, 'post', '/api/v1/checkout', aliceToken, {
      idempotencyKey: key,
    }).expect(201);
    expect(retry.body.orderNumber).toBe(order.orderNumber);

    const tts = await send(app, 'get', `/api/v1/ticket-types/by-event?eventId=${reservedEventId}`).expect(200);
    expect(tts.body.find((tt: { id: string }) => tt.id === premiumId).quantitySold).toBe(0);
  });

  it('cart-held seats block others; quantity stays locked', async () => {
    await send(app, 'post', '/api/v1/cart/items', bobToken, {
      ticketTypeId: premiumId,
      quantity: 1,
      seatIds: [floorSeats[0]],
    }).expect(201);

    const heldMap = await send(app, 'get', `/api/v1/events/${reservedEventId}/seat-map`).expect(200);
    const heldFloor = heldMap.body.sections.find((section: { name: string }) => section.name === 'Floor');
    const heldSeat = heldFloor.rows[0].seats.find((seat: { id: string }) => seat.id === floorSeats[0]);
    expect(heldSeat.occupied).toBe(false);
    expect(heldSeat.held).toBe(true);
    expect(heldFloor.rows[0].seats.filter((seat: { held: boolean }) => seat.held)).toHaveLength(1);

    await send(app, 'post', '/api/v1/cart/items', aliceToken, {
      ticketTypeId: premiumId,
      quantity: 1,
      seatIds: [floorSeats[0]],
    })
      .expect(409)
      .expect((res) => {
        expect(res.body.code).toBe('SEAT_ALREADY_IN_CART');
      });

    const cartLines = (await send(app, 'get', '/api/v1/cart', bobToken).expect(200)).body.items;
    await send(app, 'patch', `/api/v1/cart/items/${cartLines[0].id}`, bobToken, { quantity: 3 })
      .expect(409)
      .expect((res) => {
        expect(res.body.code).toBe('RESERVED_SEATS_FIXED');
      });

    const bobOrder = await send(app, 'post', '/api/v1/checkout', bobToken, {}).expect(201);
    bobOrderId = bobOrder.body.id;
    expect(bobOrder.body.items[0].tickets[0].seatLabel).toBe('Floor \u00b7 A \u00b7 1');
  });

  it('occupied seats and cross-event seat reuse are handled', async () => {
    await send(app, 'post', '/api/v1/cart/items', aliceToken, {
      ticketTypeId: premiumId,
      quantity: 1,
      seatIds: [floorSeats[0]],
    })
      .expect(409)
      .expect((res) => {
        expect(res.body.code).toBe('SEAT_TAKEN');
      });

    await send(app, 'post', '/api/v1/cart/items', aliceToken, {
      ticketTypeId: reserved2TtId,
      quantity: 1,
      seatIds: [floorSeats[0]],
    })
      .expect(201)
      .expect((res) => {
        expect(res.body.subtotalCents).toBe(3000);
      });

    const seatMap = await send(app, 'get', `/api/v1/events/${reservedEventId}/seat-map`).expect(200);
    const floor = seatMap.body.sections.find((section: { name: string }) => section.name === 'Floor');
    expect(floor.rows[0].seats[0].occupied).toBe(true);
  });

  it('refund frees the seat for repurchase; second event sells the same seat', async () => {
    const mobile = await send(app, 'get', '/api/v1/cart', bobToken).expect(200);
    expect(mobile.body.items).toHaveLength(0);

    const refunded = await send(app, 'post', `/api/v1/admin/orders/${bobOrderId}/refund`, adminToken).expect(201);
    expect(refunded.body.status).toBe('refunded');

    await send(app, 'post', '/api/v1/cart/items', aliceToken, {
      ticketTypeId: premiumId,
      quantity: 1,
      seatIds: [floorSeats[0]],
    }).expect(201);

    const checkout = await send(app, 'post', '/api/v1/checkout', aliceToken, {}).expect(201);
    expect(checkout.body.totalCents).toBe(7000);
    const labels = checkout.body.items.flatMap((item: { tickets: { seatLabel: string }[] }) =>
      item.tickets.map((ticket: { seatLabel: string }) => ticket.seatLabel),
    );
    expect(labels).toEqual(expect.arrayContaining(['Floor \u00b7 A \u00b7 1']));
    expect(labels).toHaveLength(2);
  });
});