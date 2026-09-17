import {
  ALMOST_SOLD_OUT_THRESHOLD_PERCENT,
  type EventAvailability,
  type EventAvailabilityState,
} from '@eventia/shared';

export interface AvailabilitySource {
  quantity: number;
  quantitySold: number;
}

export interface SalesWindow {
  salesStartsAt: Date | null;
  salesEndsAt: Date | null;
}

export const computeAvailability = (
  ticketTypes: AvailabilitySource[],
): Omit<EventAvailability, 'state'> &
  Pick<EventAvailability, 'state'> => {
  const totalStock = ticketTypes.reduce((sum, t) => sum + t.quantity, 0);
  const soldCount = ticketTypes.reduce((sum, t) => sum + t.quantitySold, 0);
  const soldPercent = totalStock > 0 ? (soldCount / totalStock) * 100 : 0;

  let state: EventAvailabilityState;
  if (totalStock === 0 || soldCount >= totalStock) {
    state = 'sold_out';
  } else if (totalStock - soldCount <= (totalStock * ALMOST_SOLD_OUT_THRESHOLD_PERCENT) / 100) {
    state = 'almost_sold_out';
  } else {
    state = 'available';
  }

  return { state, totalStock, soldCount, soldPercent };
};

export const isSalesOpen = (ticketType: SalesWindow): boolean => {
  const now = Date.now();
  if (ticketType.salesStartsAt && ticketType.salesStartsAt.getTime() > now) return false;
  if (ticketType.salesEndsAt && ticketType.salesEndsAt.getTime() < now) return false;
  return true;
};