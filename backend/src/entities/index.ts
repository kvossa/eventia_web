import { Cart } from './cart.entity.js';
import { CartItem } from './cart-item.entity.js';
import { CartItemSeat } from './cart-item-seat.entity.js';
import { Category } from './category.entity.js';
import { EmailOutboxRecord } from './email-outbox.entity.js';
import { Event } from './event.entity.js';
import { Favorite } from './favorite.entity.js';
import { Notification } from './notification.entity.js';
import { Order } from './order.entity.js';
import { OrderItem } from './order-item.entity.js';
import { Organizer } from './organizer.entity.js';
import { Payment } from './payment.entity.js';
import { RefreshSession } from './refresh-session.entity.js';
import { Seat } from './seat.entity.js';
import { Section } from './section.entity.js';
import { SeatRow } from './seat-row.entity.js';
import { Ticket } from './ticket.entity.js';
import { TicketType } from './ticket-type.entity.js';
import { TicketTypeSection } from './ticket-type-section.entity.js';
import { User } from './user.entity.js';
import { Venue } from './venue.entity.js';

export const entities = [
  User,
  RefreshSession,
  Favorite,
  Category,
  Organizer,
  Venue,
  Event,
  TicketType,
  Cart,
  CartItem,
  CartItemSeat,
  Order,
  OrderItem,
  Ticket,
  Payment,
  Notification,
  EmailOutboxRecord,
  Section,
  SeatRow,
  Seat,
  TicketTypeSection,
];