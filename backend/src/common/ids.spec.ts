import { describe, expect, it } from 'vitest';
import { generateOrderNumber, generateTicketUniqueId } from './ids.js';

describe('generateOrderNumber', () => {
  it('uses the EVT prefix and a date stamp', () => {
    const number = generateOrderNumber();
    expect(number.startsWith('EVT-')).toBe(true);
    expect(/\d{8}-[0-9A-F]{8}$/.test(number.slice(4))).toBe(true);
  });

  it('produces unique numbers', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100; i++) seen.add(generateOrderNumber());
    expect(seen.size).toBe(100);
  });
});

describe('generateTicketUniqueId', () => {
  it('uses the TIX prefix and is uppercase hex', () => {
    const id = generateTicketUniqueId();
    expect(id.startsWith('TIX-')).toBe(true);
    expect(/^TIX-[0-9A-F]{16}$/.test(id)).toBe(true);
  });
});