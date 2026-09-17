const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const parseTtlMs = (value: string): number => {
  const match = /^(\d+)\s*(ms|s|m|h|d)?$/i.exec(value.trim());
  if (!match) return Number(value);
  const unit = (match[2] ?? 'ms').toLowerCase();
  return Number(match[1]) * UNIT_MS[unit];
};