import { describe, expect, it } from 'vitest';
import { parseTtlMs } from './duration.js';

describe('parseTtlMs', () => {
  it('parses day suffixed values', () => {
    expect(parseTtlMs('30d')).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('parses hour suffixed values', () => {
    expect(parseTtlMs('2h')).toBe(2 * 60 * 60 * 1000);
  });

  it('parses minute suffixed values', () => {
    expect(parseTtlMs('15m')).toBe(15 * 60 * 1000);
  });

  it('parses bare second values', () => {
    expect(parseTtlMs('5000')).toBe(5000);
  });

  it('treats unknown shapes as numbers', () => {
    expect(Number.isNaN(parseTtlMs('10x'))).toBe(true);
  });
});