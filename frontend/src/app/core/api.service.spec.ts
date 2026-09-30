import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api.service';

TestBed.configureTestingModule({ providers: [provideHttpClient()] });

const service = TestBed.runInInjectionContext(() => new ApiService());
const url = (path: string): string =>
  (service as unknown as { url: (p: string) => string }).url(path);

const BASE = 'http://localhost:3000/api/v1';

describe('ApiService.url', () => {
  it('builds relative paths against the api base', () => {
    expect(url('/events')).toBe(`${BASE}/events`);
    expect(url('/admin/stats')).toBe(`${BASE}/admin/stats`);
  });

  it('never doubles the /api/v1 prefix', () => {
    expect(url('/api/v1/events')).toBe(`${BASE}/events`);
    expect(url('/api/v1/admin/orders/abc-123')).toBe(`${BASE}/admin/orders/abc-123`);
  });

  it('keeps nested dynamic paths intact', () => {
    expect(url('/cart/items/item-1')).toBe(`${BASE}/cart/items/item-1`);
    expect(url('/api/v1/cart/items/item-1')).toBe(`${BASE}/cart/items/item-1`);
  });

  it('normalises a bare prefix and a missing leading slash', () => {
    expect(url('/api/v1')).toBe(`${BASE}/`);
    expect(url('events')).toBe(`${BASE}/events`);
  });
});
