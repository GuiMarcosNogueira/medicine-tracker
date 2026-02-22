import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getExpiryStatus,
  daysUntilExpiry,
  formatExpiryDate,
  EXPIRY_COLORS,
  EXPIRY_LABELS,
} from '../utils/expiry';

// Use local midnight so YYYY-MM-DD strings parsed as local dates align with "today"
// (avoids UTC midnight → previous-day-in-UTC-3 timezone shift)
const TODAY_LOCAL = new Date(2026, 1, 22, 0, 0, 0, 0); // Feb 22 2026 local midnight

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(TODAY_LOCAL);
});

afterEach(() => {
  vi.useRealTimers();
});

function dateOffset(days: number): string {
  // Arithmetic via Date constructor handles month/year rollovers automatically
  const d = new Date(2026, 1, 22 + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ─── getExpiryStatus ──────────────────────────────────────────────────────────

describe('getExpiryStatus', () => {
  it('retorna "expired" para data de ontem (days = -1)', () => {
    expect(getExpiryStatus(dateOffset(-1))).toBe('expired');
  });

  it('retorna "expired" para data muito no passado', () => {
    expect(getExpiryStatus('2020-01-01')).toBe('expired');
  });

  it('retorna "critical" para hoje (days = 0)', () => {
    expect(getExpiryStatus(dateOffset(0))).toBe('critical');
  });

  it('retorna "critical" para dias = 1', () => {
    expect(getExpiryStatus(dateOffset(1))).toBe('critical');
  });

  it('retorna "critical" para dias = 7 (boundary superior de critical)', () => {
    expect(getExpiryStatus(dateOffset(7))).toBe('critical');
  });

  it('retorna "warning" para dias = 8 (boundary inferior de warning)', () => {
    expect(getExpiryStatus(dateOffset(8))).toBe('warning');
  });

  it('retorna "warning" para dias = 15 (boundary superior de warning)', () => {
    expect(getExpiryStatus(dateOffset(15))).toBe('warning');
  });

  it('retorna "soon" para dias = 16 (boundary inferior de soon)', () => {
    expect(getExpiryStatus(dateOffset(16))).toBe('soon');
  });

  it('retorna "soon" para dias = 30 (boundary superior de soon)', () => {
    expect(getExpiryStatus(dateOffset(30))).toBe('soon');
  });

  it('retorna "ok" para dias = 31 (acima de 30)', () => {
    expect(getExpiryStatus(dateOffset(31))).toBe('ok');
  });

  it('retorna "ok" para data muito no futuro', () => {
    expect(getExpiryStatus('2035-12-31')).toBe('ok');
  });
});

// ─── daysUntilExpiry ──────────────────────────────────────────────────────────

describe('daysUntilExpiry', () => {
  it('retorna 0 para hoje', () => {
    expect(daysUntilExpiry(dateOffset(0))).toBe(0);
  });

  it('retorna número positivo para data futura', () => {
    expect(daysUntilExpiry(dateOffset(30))).toBe(30);
  });

  it('retorna número negativo para data passada', () => {
    expect(daysUntilExpiry(dateOffset(-5))).toBe(-5);
  });

  it('retorna 7 para exatamente 7 dias', () => {
    expect(daysUntilExpiry(dateOffset(7))).toBe(7);
  });
});

// ─── formatExpiryDate ─────────────────────────────────────────────────────────

describe('formatExpiryDate', () => {
  it('converte YYYY-MM-DD para DD/MM/YYYY', () => {
    expect(formatExpiryDate('2027-08-31')).toBe('31/08/2027');
  });

  it('converte corretamente data com dia/mês de 1 dígito no source', () => {
    expect(formatExpiryDate('2026-01-05')).toBe('05/01/2026');
  });

  it('converte data de dezembro', () => {
    expect(formatExpiryDate('2028-12-01')).toBe('01/12/2028');
  });
});

// ─── EXPIRY_COLORS ────────────────────────────────────────────────────────────

describe('EXPIRY_COLORS', () => {
  it('tem cor para todos os status', () => {
    const statuses = ['expired', 'critical', 'warning', 'soon', 'ok'] as const;
    for (const s of statuses) {
      expect(EXPIRY_COLORS[s]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

// ─── EXPIRY_LABELS ────────────────────────────────────────────────────────────

describe('EXPIRY_LABELS', () => {
  it('tem label para todos os status', () => {
    const statuses = ['expired', 'critical', 'warning', 'soon', 'ok'] as const;
    for (const s of statuses) {
      expect(typeof EXPIRY_LABELS[s]).toBe('string');
      expect(EXPIRY_LABELS[s].length).toBeGreaterThan(0);
    }
  });
});
