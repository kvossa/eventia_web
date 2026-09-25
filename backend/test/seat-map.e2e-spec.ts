import request from 'supertest';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';

const ADMIN_EMAIL = 'root@eventia.local';
const ADMIN_PASSWORD = 'adminpass1234';
const suffix = `sm-${Date.now().toString(36)}`;

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

describe('Seat map (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let customerToken: string;
  let venueId: string;

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

    const customer = await send(app, 'post', '/api/v1/auth/register', undefined, {
      email: `customer-${suffix}@example.com`,
      password: 'customer123',
      name: 'Seatmap Customer',
    }).expect(201);
    customerToken = customer.body.accessToken;

    const venue = await send(app, 'post', '/api/v1/venues', adminToken, {
      name: `E2E Seatmap ${suffix}`,
      city: 'Berlin',
      address: 'Mapstr. 2',
    }).expect(201);
    venueId = venue.body.id;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('admin can create sections and the public layout is served in order', async () => {
    const floor = await send(app, 'post', `/api/v1/admin/venues/${venueId}/sections`, adminToken, {
      name: 'Floor',
      sortOrder: 0,
    }).expect(201);
    const balcony = await send(app, 'post', `/api/v1/admin/venues/${venueId}/sections`, adminToken, {
      name: 'Balcony',
    }).expect(201);
    expect(balcony.body.sortOrder).toBe(0);

    await send(app, 'patch', `/api/v1/admin/venues/sections/${balcony.body.id}`, adminToken, {
      sortOrder: 1,
    }).expect(200);

    const layout = await send(app, 'get', `/api/v1/venues/${venueId}/layout`).expect(200);
    expect(layout.body.sections.map((s: { id: string }) => s.id)).toEqual([floor.body.id, balcony.body.id]);
    expect(layout.body.sections[0].rows).toEqual([]);
  });

  it('row creation materializes seats with accessible flags; duplicate label is 409', async () => {
    const floor = (await send(app, 'get', `/api/v1/venues/${venueId}/layout`).expect(200)).body.sections[0];

    await send(app, 'post', `/api/v1/admin/venues/sections/${floor.id}/rows`, adminToken, {
      label: 'A',
      seatCount: 3,
      accessibleNumbers: [1],
    }).expect(201);

    await send(app, 'post', `/api/v1/admin/venues/sections/${floor.id}/rows`, adminToken, {
      label: 'A',
      seatCount: 3,
    })
      .expect(409)
      .expect((res) => {
        expect(res.body.code).toBe('ROW_LABEL_TAKEN');
      });

    const layout = await send(app, 'get', `/api/v1/venues/${venueId}/layout`).expect(200);
    const rowA = layout.body.sections[0].rows[0];
    expect(rowA.label).toBe('A');
    expect(rowA.seats.map((s: { number: number }) => s.number)).toEqual([1, 2, 3]);
    expect(rowA.seats.map((s: { isAccessible: boolean }) => s.isAccessible)).toEqual([true, false, false]);
  });

  it('row rebuild re-enumerates seats and rejects bad seat counts', async () => {
    const floor = (await send(app, 'get', `/api/v1/venues/${venueId}/layout`).expect(200)).body.sections[0];
    const rowA = floor.rows[0];

    await send(app, 'post', `/api/v1/admin/venues/sections/${floor.id}/rows`, adminToken, {
      label: 'B',
      seatCount: 2,
    }).expect(201);

    await send(app, 'patch', `/api/v1/admin/venues/rows/${rowA.id}`, adminToken, {
      label: 'A',
      seatCount: 5,
      accessibleNumbers: [2],
    }).expect(200);

    const layout = await send(app, 'get', `/api/v1/venues/${venueId}/layout`).expect(200);
    const rebuilt = layout.body.sections[0].rows.find((r: { label: string }) => r.label === 'A');
    expect(rebuilt.seats.map((s: { number: number }) => s.number)).toEqual([1, 2, 3, 4, 5]);
    expect(rebuilt.seats[1].isAccessible).toBe(true);
    expect(rebuilt.seats.every((s: { number: number }, i: number) => i === 1 || s.isAccessible === false)).toBe(true);

    await send(app, 'post', `/api/v1/admin/venues/sections/${floor.id}/rows`, adminToken, {
      label: 'C',
      seatCount: 0,
    }).expect(400);

    await send(app, 'post', `/api/v1/admin/venues/sections/${floor.id}/rows`, adminToken, {
      label: 'D',
      seatCount: 3,
      accessibleNumbers: [4],
    }).expect(422);

    await send(app, 'post', `/api/v1/admin/venues/sections/${floor.id}/rows`, adminToken, {
      label: 'E',
      seatCount: 3,
      accessibleNumbers: [1, 1],
    }).expect(422);
  });

  it('deleting rows and sections cascades seats and keeps layout served', async () => {
    const floor = (await send(app, 'get', `/api/v1/venues/${venueId}/layout`).expect(200)).body.sections[0];
    const rowB = floor.rows.find((r: { label: string }) => r.label === 'B');

    await send(app, 'delete', `/api/v1/admin/venues/rows/${rowB.id}`, adminToken).expect(200);

    let layout = await send(app, 'get', `/api/v1/venues/${venueId}/layout`).expect(200);
    expect(layout.body.sections[0].rows.some((r: { label: string }) => r.label === 'B')).toBe(false);

    await send(app, 'delete', `/api/v1/admin/venues/sections/${floor.id}`, adminToken).expect(200);

    layout = await send(app, 'get', `/api/v1/venues/${venueId}/layout`).expect(200);
    expect(layout.body.sections.map((s: { name: string }) => s.name)).toEqual(['Balcony']);
  });

  it('layout admin endpoints require admin', async () => {
    await send(app, 'post', `/api/v1/admin/venues/${venueId}/sections`, customerToken, {
      name: 'Sneak',
    }).expect(403);
    await send(app, 'post', `/api/v1/admin/venues/${venueId}/sections`).expect(401);
  });
});