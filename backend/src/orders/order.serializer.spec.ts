import { describe, expect, it } from 'vitest';
import { serializeOrder, type OrderWithRelations } from './order.serializer.js';

const order = {
  id: 'o1',
  orderNumber: 'EVT-20260915-ABCD1234',
  status: 'confirmed',
  totalCents: 5000,
  idempotencyKey: 'key-1',
  createdAt: new Date('2026-09-15T10:00:00Z'),
  items: [
    {
      id: 'i1',
      unitPriceCents: 2500,
      quantity: 2,
      subtotalCents: 5000,
      event: {
        id: 'e1',
        name: 'Summer Symphony Nights',
        dateTime: new Date('2026-12-01T19:30:00Z'),
        venue: {
          id: 'v1',
          name: 'Grand Arena',
          city: 'Berlin',
          address: 'Musterstr. 1',
        },
      },
      ticketType: { id: 't1', name: 'General Admission' },
      tickets: [
        {
          id: 'tix1',
          uniqueId: 'TIX-AAAA',
          status: 'valid',
          seatLabel: null,
          qrPayload: '{"v":1}',
          pricePaidCents: 2500,
          purchasedAt: new Date('2026-09-15T10:00:00Z'),
        },
      ],
    },
  ],
  payments: [
    {
      id: 'p1',
      provider: 'simulated',
      providerRef: 'sim-1',
      status: 'succeeded',
      amountCents: 5000,
    },
  ],
} as unknown as OrderWithRelations;

describe('serializeOrder', () => {
  it('flattens items, tickets and the first payment', () => {
    const view = serializeOrder(order);
    expect(view.orderNumber).toBe('EVT-20260915-ABCD1234');
    expect(view.items).toHaveLength(1);
    expect(view.items[0].event.venue?.city).toBe('Berlin');
    expect(view.items[0].tickets[0].uniqueId).toBe('TIX-AAAA');
    expect(view.payment?.status).toBe('succeeded');
  });

  it('tolerates missing relations', () => {
    const view = serializeOrder({
      id: 'o2',
      orderNumber: 'EVT-20260915-EFGH5678',
      status: 'pending',
      totalCents: 100,
      idempotencyKey: null,
      createdAt: new Date('2026-09-15T10:00:00Z'),
    } as unknown as OrderWithRelations);
    expect(view.items).toHaveLength(0);
    expect(view.payment).toBeNull();
  });
});