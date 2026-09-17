const eurFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export function formatCents(cents: number): string {
  return eurFormat.format(cents / 100);
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${dateTimeFormat.format(d)} · ${timeFormat.format(d)}`;
}

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function formatDay(iso: string): string {
  return dayFormat.format(new Date(iso));
}