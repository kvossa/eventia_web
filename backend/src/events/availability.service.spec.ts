import { describe, expect, it } from 'vitest';
import { computeAvailability, isSalesOpen } from './availability.service.js';

describe('computeAvailability', () => {
  it('returns sold_out when there is no stock', () => {
    const result = computeAvailability([]);
    expect(result.state).toBe('sold_out');
    expect(result.totalStock).toBe(0);
  });

  it('returns sold_out when everything is sold', () => {
    const result = computeAvailability([{ quantity: 10, quantitySold: 10 }]);
    expect(result.state).toBe('sold_out');
    expect(result.soldPercent).toBe(100);
  });

  it('returns almost_sold_out near the threshold', () => {
    const result = computeAvailability([{ quantity: 100, quantitySold: 90 }]);
    expect(result.state).toBe('almost_sold_out');
  });

  it('returns available when sales are comfortably open', () => {
    const result = computeAvailability([
      { quantity: 800, quantitySold: 40 },
      { quantity: 40, quantitySold: 5 },
    ]);
    expect(result.state).toBe('available');
    expect(result.totalStock).toBe(840);
    expect(result.soldCount).toBe(45);
  });
});

describe('isSalesOpen', () => {
  it('opens when no window is set', () => {
    expect(isSalesOpen({ salesStartsAt: null, salesEndsAt: null })).toBe(true);
  });

  it('blocks before salesStartsAt', () => {
    expect(
      isSalesOpen({ salesStartsAt: new Date(Date.now() + 60_000), salesEndsAt: null }),
    ).toBe(false);
  });

  it('blocks after salesEndsAt', () => {
    expect(
      isSalesOpen({ salesStartsAt: null, salesEndsAt: new Date(Date.now() - 60_000) }),
    ).toBe(false);
  });

  it('allows inside the window', () => {
    expect(
      isSalesOpen({
        salesStartsAt: new Date(Date.now() - 60_000),
        salesEndsAt: new Date(Date.now() + 60_000),
      }),
    ).toBe(true);
  });
});