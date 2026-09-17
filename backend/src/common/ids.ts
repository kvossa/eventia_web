import { randomBytes } from 'node:crypto';

export const generateOrderNumber = (): string => {
  const date = new Date();
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('');
  const suffix = randomBytes(4).toString('hex').toUpperCase();
  return `EVT-${stamp}-${suffix}`;
};

export const generateTicketUniqueId = (): string => {
  return `TIX-${randomBytes(8).toString('hex').toUpperCase()}`;
};