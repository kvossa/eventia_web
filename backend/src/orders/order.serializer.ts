import type { OrderStatus } from '@eventia/shared';
import type { Order } from '../entities/order.entity.js';
import type { OrderItem } from '../entities/order-item.entity.js';
import type { Payment } from '../entities/payment.entity.js';
import type { Ticket } from '../entities/ticket.entity.js';

export interface OrderTicketView {
  id: string;
  uniqueId: string;
  status: Ticket['status'];
  seatLabel: string | null;
  qrPayload: string;
  pricePaidCents: number;
  purchasedAt: string;
}

export interface OrderItemView {
  id: string;
  event: {
    id: string;
    name: string;
    dateTime: string;
    venue: { id: string; name: string; city: string; address: string } | null;
  };
  ticketType: { id: string; name: string } | null;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  tickets: OrderTicketView[];
}

export interface PaymentView {
  id: string;
  provider: Payment['provider'];
  providerRef: string | null;
  status: Payment['status'];
  amountCents: number;
}

export interface OrderDetailView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalCents: number;
  idempotencyKey: string | null;
  createdAt: string;
  items: OrderItemView[];
  payment: PaymentView | null;
}

export type OrderWithRelations = Order & {
  items?: OrderItemWithRelations[];
  payments?: Payment[];
};

export type OrderItemWithRelations = OrderItem & {
  event?: OrderItem['event'];
  ticketType?: OrderItem['ticketType'];
  tickets?: Ticket[];
};

export const serializeOrder = (order: OrderWithRelations): OrderDetailView => {
  const items = (order.items ?? []).map((item) => ({
    id: item.id,
    event: {
      id: item.event?.id ?? '',
      name: item.event?.name ?? 'Unknown event',
      dateTime: item.event?.dateTime?.toISOString() ?? '',
      venue: item.event?.venue
        ? {
            id: item.event.venue.id,
            name: item.event.venue.name,
            city: item.event.venue.city,
            address: item.event.venue.address,
          }
        : null,
    },
    ticketType: item.ticketType ? { id: item.ticketType.id, name: item.ticketType.name } : null,
    unitPriceCents: item.unitPriceCents,
    quantity: item.quantity,
    subtotalCents: item.subtotalCents,
    tickets: (item.tickets ?? []).map((ticket) => ({
      id: ticket.id,
      uniqueId: ticket.uniqueId,
      status: ticket.status,
      seatLabel: ticket.seatLabel,
      qrPayload: ticket.qrPayload,
      pricePaidCents: ticket.pricePaidCents,
      purchasedAt: ticket.purchasedAt.toISOString(),
    })),
  }));

  const payment = order.payments?.[0] ?? null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    totalCents: order.totalCents,
    idempotencyKey: order.idempotencyKey,
    createdAt: order.createdAt.toISOString(),
    items,
    payment: payment
      ? {
          id: payment.id,
          provider: payment.provider,
          providerRef: payment.providerRef,
          status: payment.status,
          amountCents: payment.amountCents,
        }
      : null,
  };
};