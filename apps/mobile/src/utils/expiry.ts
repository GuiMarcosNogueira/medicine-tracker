import { differenceInCalendarDays } from 'date-fns';
import type { ExpiryStatus } from '@medstock/shared';

/**
 * Parse an ISO date string (YYYY-MM-DD) as a local calendar date.
 * Using `new Date(string)` would interpret midnight UTC, which in UTC-3 (Brasília)
 * shifts the date one day back — causing wrong expiry status for Brazilian users.
 */
function parseLocalDate(iso: string): Date {
  const parts = iso.split('-');
  /* v8 ignore next -- fallbacks unreachable for valid YYYY-MM-DD strings (noUncheckedIndexedAccess) */
  return new Date(Number(parts[0] ?? '0'), Number(parts[1] ?? '1') - 1, Number(parts[2] ?? '1'));
}

export function getExpiryStatus(expiryDate: string): ExpiryStatus {
  const days = differenceInCalendarDays(parseLocalDate(expiryDate), new Date());
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 15) return 'warning';
  if (days <= 30) return 'soon';
  return 'ok';
}

export function daysUntilExpiry(expiryDate: string): number {
  return differenceInCalendarDays(parseLocalDate(expiryDate), new Date());
}

export function formatExpiryDate(expiryDate: string): string {
  const parts = expiryDate.split('-');
  /* v8 ignore next 3 -- fallbacks unreachable for valid YYYY-MM-DD strings */
  const y = parts[0] ?? '';
  const m = parts[1] ?? '';
  const d = parts[2] ?? '';
  return `${d}/${m}/${y}`;
}

export const EXPIRY_COLORS: Record<ExpiryStatus, string> = {
  expired:  '#F0735A', // coral-500
  critical: '#F0735A', // coral-500
  warning:  '#F5A623', // amber-500
  soon:     '#F7BE5A', // amber-400
  ok:       '#22C9BF', // teal-500
};

export const EXPIRY_LABELS: Record<ExpiryStatus, string> = {
  expired:  'Vencido',
  critical: 'Vence em 7 dias',
  warning:  'Vence em 15 dias',
  soon:     'Vence em 30 dias',
  ok:       'OK',
};
