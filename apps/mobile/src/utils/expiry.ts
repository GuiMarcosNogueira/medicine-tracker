import { differenceInCalendarDays } from 'date-fns';
import type { ExpiryStatus } from '@medstock/shared';

export function getExpiryStatus(expiryDate: string): ExpiryStatus {
  const days = differenceInCalendarDays(new Date(expiryDate), new Date());
  if (days < 0) return 'expired';
  if (days <= 7) return 'critical';
  if (days <= 15) return 'warning';
  if (days <= 30) return 'soon';
  return 'ok';
}

export function daysUntilExpiry(expiryDate: string): number {
  return differenceInCalendarDays(new Date(expiryDate), new Date());
}

export function formatExpiryDate(expiryDate: string): string {
  const parts = expiryDate.split('-');
  const y = parts[0] ?? '';
  const m = parts[1] ?? '';
  const d = parts[2] ?? '';
  return `${d}/${m}/${y}`;
}

export const EXPIRY_COLORS: Record<ExpiryStatus, string> = {
  expired:  '#ef4444',
  critical: '#f97316',
  warning:  '#eab308',
  soon:     '#3b82f6',
  ok:       '#22c55e',
};

export const EXPIRY_LABELS: Record<ExpiryStatus, string> = {
  expired:  'Vencido',
  critical: 'Vence em 7 dias',
  warning:  'Vence em 15 dias',
  soon:     'Vence em 30 dias',
  ok:       'OK',
};
