import type { Treatment, TreatmentDose } from '@medstock/shared';

// ─── Dose schedule computation ────────────────────────────────────────────────

/**
 * Returns all scheduled dose datetimes for a treatment within [from, to].
 * Doses are computed as: firstDose + n * frequencyHours, for n = 0, 1, 2, ...
 */
export function computeScheduledDoses(
  treatment: Treatment,
  from: Date,
  to: Date,
): Date[] {
  const [hourStr, minuteStr] = treatment.first_dose_time.split(':');
  const hour = Number(hourStr);
  const minute = Number(minuteStr ?? 0);

  // Build first dose datetime in local time from start_date + first_dose_time
  const [y, m, d] = treatment.start_date.split('-').map(Number);
  const firstDose = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, hour, minute, 0, 0);

  // End boundary: end_date at 23:59:59 local time, or 1 year from now if indefinite
  let endDate: Date;
  if (treatment.end_date) {
    const [ey, em, ed] = treatment.end_date.split('-').map(Number);
    endDate = new Date(ey ?? 0, (em ?? 1) - 1, ed ?? 1, 23, 59, 59, 999);
  } else {
    endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  const upperBound = endDate < to ? endDate : to;
  const intervalMs = treatment.frequency_hours * 60 * 60 * 1000;
  const doses: Date[] = [];

  // Advance firstDose to the first slot >= from
  let current = new Date(firstDose);
  if (current < from) {
    const offset = Math.ceil((from.getTime() - current.getTime()) / intervalMs);
    current = new Date(current.getTime() + offset * intervalMs);
  }

  while (current <= upperBound) {
    doses.push(new Date(current));
    current = new Date(current.getTime() + intervalMs);
  }

  return doses;
}

// ─── Today's dose slots ───────────────────────────────────────────────────────

export type DoseSlot = {
  treatment: Treatment;
  scheduledAt: Date;
  logged: TreatmentDose | null;
};

/**
 * Returns all dose slots for today, paired with their logged status (or null if pending).
 * Sorted by scheduledAt ascending.
 */
export function getTodaySlots(
  treatments: Treatment[],
  loggedDoses: TreatmentDose[],
  now: Date = new Date(),
): DoseSlot[] {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const slots: DoseSlot[] = [];

  for (const t of treatments) {
    if (t.status !== 'active') continue;
    const scheduledTimes = computeScheduledDoses(t, startOfDay, endOfDay);
    for (const scheduledAt of scheduledTimes) {
      const logged =
        loggedDoses.find(
          d =>
            d.treatment_id === t.id &&
            Math.abs(new Date(d.scheduled_at).getTime() - scheduledAt.getTime()) < 60_000,
        ) ?? null;
      slots.push({ treatment: t, scheduledAt, logged });
    }
  }

  return slots.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

// ─── Adherence stats ──────────────────────────────────────────────────────────

export interface AdherenceStats {
  total: number;
  taken: number;
  skipped: number;
  pending: number;
  pct: number; // 0–100, based on (taken / total past doses)
}

/**
 * Computes adherence statistics for a treatment up to `now`.
 * Only counts past slots (scheduled_at <= now) toward total.
 */
export function getAdherenceStats(
  treatment: Treatment,
  loggedDoses: TreatmentDose[],
  now: Date = new Date(),
): AdherenceStats {
  const [y, m, d] = treatment.start_date.split('-').map(Number);
  const startOfTreatment = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0);

  const pastSlots = computeScheduledDoses(treatment, startOfTreatment, now);
  const total = pastSlots.length;
  if (total === 0) return { total: 0, taken: 0, skipped: 0, pending: 0, pct: 0 };

  let taken = 0;
  let skipped = 0;

  for (const slot of pastSlots) {
    const log = loggedDoses.find(
      d =>
        d.treatment_id === treatment.id &&
        Math.abs(new Date(d.scheduled_at).getTime() - slot.getTime()) < 60_000,
    );
    if (log?.status === 'taken') taken++;
    else if (log?.status === 'skipped') skipped++;
  }

  const pending = total - taken - skipped;
  const pct = total > 0 ? Math.round((taken / total) * 100) : 0;

  return { total, taken, skipped, pending, pct };
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/** Formats frequency_hours as a human-friendly string. */
export function formatFrequency(frequencyHours: number): string {
  if (frequencyHours === 24) return '1x/dia';
  if (frequencyHours === 12) return '2x/dia';
  if (frequencyHours === 8)  return '3x/dia';
  if (frequencyHours === 6)  return '4x/dia';
  if (frequencyHours === 4)  return '6x/dia';
  return `a cada ${frequencyHours}h`;
}

/** Formats a dose time (HH:MM string or Date) for display. */
export function formatDoseTime(scheduledAt: Date): string {
  const h = scheduledAt.getHours().toString().padStart(2, '0');
  const min = scheduledAt.getMinutes().toString().padStart(2, '0');
  return `${h}:${min}`;
}

/** Returns days remaining for a treatment, or null if indefinite. */
export function daysRemaining(treatment: Treatment, now: Date = new Date()): number | null {
  if (!treatment.end_date) return null;
  const [y, m, d] = treatment.end_date.split('-').map(Number);
  const end = new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}
