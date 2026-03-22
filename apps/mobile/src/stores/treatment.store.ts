import { observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { scheduleTreatmentNotifications } from '../lib/notifications';
import { inventoryStore, softDeleteItem } from './inventory.store';
import type { Treatment, TreatmentDose } from '@medstock/shared';

export type TreatmentRow = Treatment;
export type TreatmentDoseRow = TreatmentDose;

export const treatmentStore = observable<{
  treatments: TreatmentRow[];
  pausedTreatments: TreatmentRow[];
  completedTreatments: TreatmentRow[];
  todayDoses: TreatmentDoseRow[];
  adherenceDoses: Record<string, TreatmentDoseRow[]>;
  adherenceLoading: boolean;
  familyId: string | null;
  loading: boolean;
}>({
  treatments: [],
  pausedTreatments: [],
  completedTreatments: [],
  todayDoses: [],
  adherenceDoses: {},
  adherenceLoading: false,
  familyId: null,
  loading: false,
});

let channel: ReturnType<typeof supabase.channel> | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

export async function initTreatments(userId: string): Promise<void> {
  // Resolve familyId the same way as initInventory
  const { data: member } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('profile_id', userId)
    .maybeSingle();

  const fid = (member as { family_id: string } | null)?.family_id ?? null;
  if (!fid) return;

  treatmentStore.familyId.set(fid);
  await refreshTreatments(fid);
  subscribeRealtime(fid);
}

export async function refreshTreatments(familyId: string): Promise<void> {
  treatmentStore.loading.set(true);

  const { data: treatmentsData } = await supabase
    .from('treatments')
    .select('*')
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('created_at');

  const rows = (treatmentsData ?? []) as unknown as TreatmentRow[];

  const activeRows    = rows.filter(t => t.status === 'active');
  const pausedRows    = rows.filter(t => t.status === 'paused');
  const completedRows = rows.filter(t => t.status === 'completed' || t.status === 'cancelled');

  treatmentStore.treatments.set(activeRows);
  treatmentStore.pausedTreatments.set(pausedRows);
  treatmentStore.completedTreatments.set(completedRows);

  const doses = await loadTodayDoses(activeRows.map(t => t.id));
  treatmentStore.todayDoses.set(doses);

  treatmentStore.loading.set(false);

  void scheduleTreatmentNotifications(activeRows).catch(() => undefined);
}

async function loadTodayDoses(treatmentIds: string[]): Promise<TreatmentDoseRow[]> {
  if (treatmentIds.length === 0) return [];

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const { data } = await supabase
    .from('treatment_doses')
    .select('*')
    .in('treatment_id', treatmentIds)
    .gte('scheduled_at', startOfDay.toISOString())
    .lte('scheduled_at', endOfDay.toISOString());

  return (data ?? []) as unknown as TreatmentDoseRow[];
}

export async function loadAdherenceData(): Promise<void> {
  if (treatmentStore.adherenceLoading.get()) return;
  treatmentStore.adherenceLoading.set(true);

  const allTreatments = [
    ...treatmentStore.treatments.get(),
    ...treatmentStore.pausedTreatments.get(),
    ...treatmentStore.completedTreatments.get(),
  ];

  if (allTreatments.length === 0) {
    treatmentStore.adherenceLoading.set(false);
    return;
  }

  const ids = allTreatments.map(t => t.id);
  const { data } = await supabase
    .from('treatment_doses')
    .select('*')
    .in('treatment_id', ids);

  const doses = (data ?? []) as unknown as TreatmentDoseRow[];
  const grouped: Record<string, TreatmentDoseRow[]> = {};
  for (const dose of doses) {
    const arr = grouped[dose.treatment_id];
    if (arr) {
      arr.push(dose);
    } else {
      grouped[dose.treatment_id] = [dose];
    }
  }

  treatmentStore.adherenceDoses.set(grouped);
  treatmentStore.adherenceLoading.set(false);
}

export async function addTreatment(
  payload: Omit<TreatmentRow, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('treatments')
    .insert(payload)
    .select('*')
    .single();

  if (error) return error.message;

  if (data) {
    const row = data as unknown as TreatmentRow;
    const updated = [...treatmentStore.treatments.get(), row];
    treatmentStore.treatments.set(updated);
    void scheduleTreatmentNotifications(updated).catch(() => undefined);
  }

  return null;
}

export async function reactivateTreatment(
  id: string,
  newStartDate: string,
): Promise<string | null> {
  const original = treatmentStore.completedTreatments.get().find(t => t.id === id);
  if (!original) return 'Tratamento não encontrado';

  let newEndDate: string | null = null;
  if (original.end_date) {
    const [sy, sm, sd] = original.start_date.split('-').map(Number);
    const [ey, em, ed] = original.end_date.split('-').map(Number);
    const origStart = new Date(sy ?? 0, (sm ?? 1) - 1, sd ?? 1);
    const origEnd   = new Date(ey ?? 0, (em ?? 1) - 1, ed ?? 1);
    const durationMs = origEnd.getTime() - origStart.getTime();
    const [ny, nm, nd] = newStartDate.split('-').map(Number);
    const newStart = new Date(ny ?? 0, (nm ?? 1) - 1, nd ?? 1);
    const newEnd   = new Date(newStart.getTime() + durationMs);
    newEndDate = `${newEnd.getFullYear()}-${String(newEnd.getMonth() + 1).padStart(2, '0')}-${String(newEnd.getDate()).padStart(2, '0')}`;
  }

  return addTreatment({
    family_id:           original.family_id,
    person_name:         original.person_name,
    inventory_item_id:   original.inventory_item_id,
    medication_name:     original.medication_name,
    active_ingredient:   original.active_ingredient,
    presentation_dosage: original.presentation_dosage,
    pharma_form_friendly: original.pharma_form_friendly,
    dose_quantity:       original.dose_quantity,
    dose_unit:           original.dose_unit,
    frequency_hours:     original.frequency_hours,
    start_date:          newStartDate,
    end_date:            newEndDate,
    first_dose_time:     original.first_dose_time,
    notes:               original.notes,
    status:              'active',
  });
}

export async function logDose(
  treatmentId: string,
  scheduledAt: Date,
  status: 'taken' | 'skipped',
): Promise<string | null> {
  const { data, error } = await supabase.rpc('log_dose', {
    p_treatment_id: treatmentId,
    p_scheduled_at: scheduledAt.toISOString(),
    p_status:       status,
  });

  if (error) return error.message;

  if (data) {
    const newDose: TreatmentDoseRow = {
      id:                data as string,
      treatment_id:      treatmentId,
      scheduled_at:      scheduledAt.toISOString(),
      status,
      taken_at:          status === 'taken' ? new Date().toISOString() : null,
      quantity_deducted: null,
      created_at:        new Date().toISOString(),
    };
    treatmentStore.todayDoses.set([...treatmentStore.todayDoses.get(), newDose]);

    // Optimistically update inventory quantity; auto-remove if esgotado
    if (status === 'taken') {
      const treatment = treatmentStore.treatments.get().find(t => t.id === treatmentId);
      if (treatment?.inventory_item_id) {
        const invItemId  = treatment.inventory_item_id;
        // 1 gota = 0,05 mL (20 gotas = 1 mL — padrão farmacêutico BR)
        const deductQty  = treatment.dose_unit === 'gotas'
          ? treatment.dose_quantity * 0.05
          : treatment.dose_quantity;
        const items      = inventoryStore.items.get();
        const current    = items.find(i => i.id === invItemId)?.quantity ?? 0;
        const newQty     = Math.max(0, current - deductQty);
        const updated    = items.map(item =>
          item.id === invItemId ? { ...item, quantity: newQty } : item,
        );
        inventoryStore.items.set(updated);

        if (newQty === 0) {
          void softDeleteItem(invItemId);
        }
      }
    }
  }

  return null;
}

export async function updateTreatmentStatus(
  id: string,
  status: 'active' | 'paused' | 'completed' | 'cancelled',
): Promise<string | null> {
  const { error } = await supabase
    .from('treatments')
    .update({ status })
    .eq('id', id);

  if (error) return error.message;

  // Find the treatment across all lists
  const treatment =
    treatmentStore.treatments.get().find(t => t.id === id) ??
    treatmentStore.pausedTreatments.get().find(t => t.id === id) ??
    treatmentStore.completedTreatments.get().find(t => t.id === id);

  if (treatment) {
    const updated = { ...treatment, status };

    // Remove from all lists
    const remove = (list: TreatmentRow[]) => list.filter(t => t.id !== id);
    treatmentStore.treatments.set(remove(treatmentStore.treatments.get()));
    treatmentStore.pausedTreatments.set(remove(treatmentStore.pausedTreatments.get()));
    treatmentStore.completedTreatments.set(remove(treatmentStore.completedTreatments.get()));

    // Add to the correct list
    if (status === 'active') {
      treatmentStore.treatments.set([...treatmentStore.treatments.get(), updated]);
    } else if (status === 'paused') {
      treatmentStore.pausedTreatments.set([...treatmentStore.pausedTreatments.get(), updated]);
    } else {
      treatmentStore.completedTreatments.set([...treatmentStore.completedTreatments.get(), updated]);
    }
  }

  const active = treatmentStore.treatments.get();
  void scheduleTreatmentNotifications(active).catch(() => undefined);

  return null;
}

export async function softDeleteTreatment(id: string): Promise<string | null> {
  const { error } = await supabase.rpc('soft_delete_treatment', { p_treatment_id: id });

  if (!error) {
    const remove = (list: TreatmentRow[]) => list.filter(t => t.id !== id);
    treatmentStore.treatments.set(remove(treatmentStore.treatments.get()));
    treatmentStore.pausedTreatments.set(remove(treatmentStore.pausedTreatments.get()));
    treatmentStore.completedTreatments.set(remove(treatmentStore.completedTreatments.get()));
    void scheduleTreatmentNotifications(treatmentStore.treatments.get()).catch(() => undefined);
  }

  return error?.message ?? null;
}

export function cleanupTreatments(): void {
  channel?.unsubscribe();
  channel = null;
  treatmentStore.set({
    treatments: [],
    pausedTreatments: [],
    completedTreatments: [],
    todayDoses: [],
    adherenceDoses: {},
    adherenceLoading: false,
    familyId: null,
    loading: false,
  });
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

function subscribeRealtime(familyId: string): void {
  channel?.unsubscribe();
  channel = supabase
    .channel(`tr:${familyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'treatments',
        filter: `family_id=eq.${familyId}`,
      },
      () => {
        void refreshTreatments(familyId);
      },
    )
    .subscribe();
}
