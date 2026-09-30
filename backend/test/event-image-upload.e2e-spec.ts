import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname } from 'node:path';
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { UPLOAD_ROOT, uploadPath } from '../src/common/uploads.js';
import { configureTestApp } from './test-app.helper.js';

const ADMIN_EMAIL = 'root@eventia.local';
const ADMIN_PASSWORD = 'adminpass1234';
const suffix = `img-${Date.now().toString(36)}`;
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const FIXTURE_DIR = uploadPath('e2e-fixtures');

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

function writeFixture(name: string, bytes: Buffer): string {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const path = uploadPath('e2e-fixtures', name);
  writeFileSync(path, bytes);
  return path;
}

function attach(token: string, path: string, options?: { contentType?: string; field?: string }) {
  let req = request(app.getHttpServer())
    .post(`/api/v1/admin/events/${eventId}/image`)
    .set('Authorization', `Bearer ${token}`);
  const call = req.attach(options?.field ?? 'file', path, {
    contentType: options?.contentType ?? 'image/png',
  });
  call.on('response', (res: { statusCode?: number; body?: { imageUrl?: string } }) => {
    const url = res.body?.imageUrl;
    if (res.statusCode === 201 && url) storedFiles.push(url.split('/').pop() as string);
  });
  return call;
}

let app: INestApplication;
let adminToken: string;
let eventId: string;
const storedFiles: string[] = [];

describe('Admin event image upload (e2e)', () => {
  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureTestApp(app);
    await app.init();

    adminToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        .expect(200)
    ).body.accessToken;

    const category = await request(app.getHttpServer())
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `E2E Image Cat ${suffix}`, slug: `e2e-image-cat-${suffix}` })
      .expect(201);
    const organizer = await request(app.getHttpServer())
      .post('/api/v1/organizers')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `E2E Image Org ${suffix}`, slug: `e2e-image-org-${suffix}` })
      .expect(201);
    const venue = await request(app.getHttpServer())
      .post('/api/v1/venues')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `E2E Image Hall ${suffix}`, city: 'Berlin', address: 'Imagestr. 7' })
      .expect(201);
    eventId = (
      await request(app.getHttpServer())
        .post('/api/v1/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: `E2E Image ${suffix}`,
          categoryId: category.body.id,
          organizerId: organizer.body.id,
          venueId: venue.body.id,
          dateTime: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    for (const name of storedFiles) rmSync(uploadPath('events', name), { force: true });
    rmSync(FIXTURE_DIR, { recursive: true, force: true });
    if (app) await app.close();
  });

  it('stores the image, returns an absolute URL and serves the file', async () => {
    const fixture = writeFixture('poster.png', PNG_BYTES);

    const res = await attach(adminToken, fixture).expect(201);

    expect(res.body.imageUrl).toMatch(
      new RegExp(`^http://127\\.0\\.0\\.1:\\d+/uploads/events/[0-9a-f-]{36}\\.png$`),
    );
    expect(res.body.id).toBe(eventId);

    const storedName = res.body.imageUrl.split('/').pop();
    expect(existsSync(uploadPath('events', storedName))).toBe(true);

    const stored = await request(app.getHttpServer())
      .get(`/uploads/events/${storedName}`)
      .buffer(true)
      .expect(200)
      .expect('Content-Type', /image\/png/);
    const served = Buffer.isBuffer(stored.body) ? stored.body : Buffer.from(String(stored.body), 'binary');
    expect(served.equals(PNG_BYTES)).toBe(true);

    const detail = await request(app.getHttpServer())
      .get(`/api/v1/admin/events/${eventId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detail.body.imageUrl).toBe(res.body.imageUrl);
  });

  it('keeps the stored extension per mime type and randomises the filename', async () => {
    const cases: [string, string][] = [
      ['poster.jpg', 'image/jpeg'],
      ['poster.webp', 'image/webp'],
      ['poster.gif', 'image/gif'],
    ];
    const names: string[] = [];
    for (const [filename, contentType] of cases) {
      const fixture = writeFixture(filename, PNG_BYTES);
      const res = await attach(adminToken, fixture, { contentType }).expect(201);
      const storedName = res.body.imageUrl.split('/').pop() as string;
      names.push(storedName);
      expect(extname(storedName)).toBe(extname(filename));
      expect(existsSync(uploadPath('events', storedName))).toBe(true);
    }
    expect(new Set(names).size).toBe(3);
  });

  it('rejects unsupported mime types, oversized files and missing files', async () => {
    const script = writeFixture('payload.png', Buffer.from('#!/bin/sh\necho hi', 'utf8'));
    const unsupported = await attach(adminToken, script, { contentType: 'text/plain' }).expect(400);
    expect(unsupported.body.code).toBe('BAD_REQUEST');
    expect(unsupported.body.errors[0]).toContain('Unsupported image type');

    const big = writeFixture('big.png', Buffer.concat([PNG_BYTES, Buffer.alloc(2 * 1024 * 1024, 1)]));
    const tooBig = await attach(adminToken, big).expect(413);
    expect(tooBig.body.errors[0]).toBe('File too large');

    const missing = await request(app.getHttpServer())
      .post(`/api/v1/admin/events/${eventId}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
    expect(missing.body.errors[0]).toContain('image file is required');
  });

  it('requires an admin token and a known event', async () => {
    const fixture = writeFixture('poster.png', PNG_BYTES);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/events/${eventId}/image`)
      .attach('file', fixture, { contentType: 'image/png' })
      .expect(401);

    const customer = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: `customer-img-${suffix}@example.com`,
        password: 'customerpass123',
        name: 'Image Customer',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/admin/events/${eventId}/image`)
      .set('Authorization', `Bearer ${customer.body.accessToken}`)
      .attach('file', fixture, { contentType: 'image/png' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/admin/events/${UNKNOWN_ID}/image`)
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', fixture, { contentType: 'image/png' })
      .expect(404);
  });

  it('keeps the uploaded bytes intact on disk', async () => {
    const fixture = writeFixture('exact.png', PNG_BYTES);
    const res = await attach(adminToken, fixture).expect(201);
    const storedName = res.body.imageUrl.split('/').pop() as string;

    expect(readFileSync(uploadPath('events', storedName)).equals(PNG_BYTES)).toBe(true);
    expect(existsSync(UPLOAD_ROOT)).toBe(true);
  });
});
