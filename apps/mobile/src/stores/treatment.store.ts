import { observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { scheduleTreatmentNotifications } from '../lib/notifications';
import { inventoryStore, softDeleteItem } from './inventory.store';
import type { Treatment, TreatmentDose } from '@medstock/shared';

export type TreatmentRow = Treatment;
export type TreatmentDoseRow = TreatmentDose;

export const treatmentStore = observable<{
  treatments: TreatmentRow[];
  todayDoses: TreatmentDoseRow[];
  familyId: string | null;
  loading: boolean;
}>({ treatments: [], todayDoses: [], familyId: null, loading: false });

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
    .eq('status', 'active')
    .order('created_at');

  const rows = (treatmentsData ?? []) as unknown as TreatmentRow[];
  treatmentStore.treatments.set(rows);

  const doses = await loadTodayDoses(rows.map(t => t.id));
  treatmentStore.todayDoses.set(doses);

  treatmentStore.loading.set(false);

  void scheduleTreatmentNotifications(rows).catch(() => undefined);
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
        const invItemId = treatment.inventory_item_id;
        const items     = inventoryStore.items.get();
        const current   = items.find(i => i.id === invItemId)?.quantity ?? 0;
        const newQty    = Math.max(0, current - treatment.dose_quantity);
        const updated   = items.map(item =>
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

  const treatments = treatmentStore.treatments.get().map(t =>
    t.id === id ? { ...t, status } : t,
  );
  treatmentStore.treatments.set(treatments);

  const active = treatments.filter(t => t.status === 'active');
  void scheduleTreatmentNotifications(active).catch(() => undefined);

  return null;
}

export async function softDeleteTreatment(id: string): Promise<string | null> {
  const { error } = await supabase.rpc('soft_delete_treatment', { p_treatment_id: id });

  if (!error) {
    const treatments = treatmentStore.treatments.get().filter(t => t.id !== id);
    treatmentStore.treatments.set(treatments);
    void scheduleTreatmentNotifications(treatments).catch(() => undefined);
  }

  return error?.message ?? null;
}

export function cleanupTreatments(): void {
  channel?.unsubscribe();
  channel = null;
  treatmentStore.set({ treatments: [], todayDoses: [], familyId: null, loading: false });
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
