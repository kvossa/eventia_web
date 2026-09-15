export const USER_ROLES = ['admin', 'customer'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const EVENT_STATUSES = [
  'draft',
  'published',
  'sold_out',
  'cancelled',
  'finished',
] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_AVAILABILITY_STATES = [
  'available',
  'almost_sold_out',
  'sold_out',
  'temporarily_unavailable',
] as const;
export type EventAvailabilityState = (typeof EVENT_AVAILABILITY_STATES)[number];

export const TICKET_STATUSES = ['valid', 'used', 'cancelled', 'refunded', 'expired'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const ORDER_STATUSES = ['pending', 'confirmed', 'cancelled', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ['pending', 'processing', 'succeeded', 'failed', 'refunded'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CART_STATUSES = ['active', 'converted', 'abandoned'] as const;
export type CartStatus = (typeof CART_STATUSES)[number];

export const NOTIFICATION_TYPES = [
  'purchase_confirmed',
  'order_cancelled',
  'ticket_reminder',
  'event_update',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CHANNELS = ['in_app', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const EMAIL_OUTBOX_STATUSES = ['pending', 'sent', 'failed'] as const;
export type EmailOutboxStatus = (typeof EMAIL_OUTBOX_STATUSES)[number];

export const PAYMENT_PROVIDERS = ['simulated'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const CART_LIFETIME_DAYS = 30;
export const ALMOST_SOLD_OUT_THRESHOLD_PERCENT = 10;
export const ORDER_NUMBER_PREFIX = 'EVT';