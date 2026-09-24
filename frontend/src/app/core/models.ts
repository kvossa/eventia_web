import type {
  EventAvailabilityState,
  EventStatus,
  OrderStatus,
  PaymentStatus,
  TicketStatus,
  UserRole,
} from '@eventia/shared';

export interface ApiError {
  code: string;
  statusCode: number;
  message: string;
  errors: string[];
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  address: string;
  capacity: number | null;
}

export interface Organizer {
  id: string;
  name: string;
  slug: string;
}

export interface EventAvailability {
  state: EventAvailabilityState;
  totalStock: number;
  soldCount: number;
  soldPercent: number;
}

export interface EventListItem {
  id: string;
  name: string;
  description: string | null;
  dateTime: string;
  city: string;
  address: string;
  status: EventStatus;
  featured: boolean;
  imageUrl: string | null;
  ageRestriction: string | null;
  accessibilityInfo: string | null;
  category: Category;
  venue: Venue;
  organizer: Organizer;
  availability: EventAvailability;
  fromPriceCents: number;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  description: string | null;
  priceCents: number;
  quantity: number;
  quantitySold: number;
  salesStartsAt: string | null;
  salesEndsAt: string | null;
  isVisible: boolean;
  maxPerCustomer: number | null;
}

export interface EventDetail extends EventListItem {
  ticketTypes: TicketType[];
}

export interface CartLineEvent {
  id: string;
  name: string;
  dateTime: string;
  city: string;
  address: string;
  status: EventStatus;
  imageUrl: string | null;
}

export interface CartLine {
  id: string;
  ticketTypeId: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
  event: CartLineEvent;
  ticketType: TicketType;
}

export interface Cart {
  id: string;
  userId: string | null;
  subtotalCents: number;
  items: CartLine[];
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface TicketEventInfo {
  id: string;
  name: string;
  dateTime: string;
  city: string;
  address: string;
  venue: Venue;
}

export interface TicketView {
  id: string;
  uniqueId: string;
  status: TicketStatus;
  seatLabel: string | null;
  qrPayload: string;
  pricePaidCents: number;
  purchasedAt: string;
  event: TicketEventInfo;
  ticketType: { id: string; name: string };
}

export interface OrderTicketView {
  id: string;
  uniqueId: string;
  status: TicketStatus;
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
    venue: Venue | null;
  };
  ticketType: { id: string; name: string } | null;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  tickets: OrderTicketView[];
}

export interface OrderDetailView {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalCents: number;
  idempotencyKey: string | null;
  createdAt: string;
  items: OrderItemView[];
  payment: {
    id: string;
    provider: string;
    providerRef: string | null;
    status: PaymentStatus;
    amountCents: number;
  } | null;
}
export interface ProfileView {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface UserUpdateInput {
  name?: string;
  email?: string;
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
}

export interface FavoriteView extends EventListItem {
  favoritedAt: string;
}

export interface MyOrderListItem extends OrderDetailView {}

export interface NotificationPreferencesInput {
  emailNotifications: boolean;
  smsNotifications: boolean;
}

export interface OrderListParams {
  page?: number;
  limit?: number;
  status?: OrderStatus;
}

export type FavoriteAddResponse = { id: string };
export type FavoriteRemoveResponse = void;
export type PasswordChangeResponse = { success: boolean };
