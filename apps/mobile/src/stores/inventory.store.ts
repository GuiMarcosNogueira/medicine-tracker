import { observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import { savePendingItem, getPendingItems, deletePendingItem } from '../lib/local-db';
import { scheduleExpiryNotifications } from '../lib/notifications';
import type { InventoryUnit } from '@medstock/shared';

// Inventory item — all display fields are denormalised snapshots
// (populated at insert time from the catalog or entered manually).
export interface InventoryRow {
  id: string;
  family_id: string;
  medication_id: string | null;
  custom_name: string | null;
  // Snapshot fields (set at add-time; null for old/offline items)
  product_name: string | null;
  manufacturer: string | null;
  active_ingredient: string | null;
  presentation_dosage: string | null;
  pharma_form_friendly: string | null;
  pharmaceutical_form: string | null;
  // Stock fields
  lot_number: string | null;
  expiry_date: string;
  quantity: number;
  unit: InventoryUnit;
  location: string | null;
  notes: string | null;
  scanned_image_url: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export const inventoryStore = observable<{
  items: InventoryRow[];
  familyId: string | null;
  loading: boolean;
}>({ items: [], familyId: null, loading: false });

let channel: ReturnType<typeof supabase.channel> | null = null;

export function getItemDisplayName(item: Pick<InventoryRow, 'product_name' | 'custom_name'>): string {
  return item.product_name ?? item.custom_name ?? 'Sem nome';
}

export async function initInventory(userId: string): Promise<void> {
  const { data: member } = await supabase
    .from('family_members')
    .select('family_id')
    .eq('profile_id', userId)
    .maybeSingle();

  const fid = (member as { family_id: string } | null)?.family_id ?? null;
  if (!fid) return;

  inventoryStore.familyId.set(fid);
  // Flush any locally queued items before fetching (fire-and-forget errors)
  void flushPendingItems(fid).catch(() => undefined);
  await refreshInventory(fid);
  subscribeRealtime(fid);
}

/**
 * Insert a new inventory item.
 * If Supabase is unreachable, saves the item to the local SQLite queue (_pending=1)
 * so it can be flushed on the next successful connection.
 * Returns null on success, or an error message on failure.
 */
export async function addInventoryItem(payload: {
  family_id: string;
  medication_id: string | null;
  custom_name: string | null;
  product_name: string | null;
  manufacturer: string | null;
  active_ingredient: string | null;
  presentation_dosage: string | null;
  pharma_form_friendly: string | null;
  pharmaceutical_form: string | null;
  expiry_date: string;
  quantity: number;
  unit: InventoryUnit;
  lot_number: string | null;
  location: string | null;
  added_by: string | null;
}): Promise<{ error: string | null; queued: boolean }> {
  const { error } = await supabase.from('inventory_items').insert(payload);
  if (!error) return { error: null, queued: false };

  // Treat any insert failure as potentially offline — save to local queue
  const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    await savePendingItem({
      id: localId,
      family_id: payload.family_id,
      medication_id: payload.medication_id,
      custom_name: payload.custom_name,
      expiry_date: payload.expiry_date,
      quantity: payload.quantity,
      unit: payload.unit,
      lot_number: payload.lot_number,
      location: payload.location,
      added_by: payload.added_by,
      created_at: new Date().toISOString(),
    });
    return { error: null, queued: true };
  } catch {
    return { error: error.message, queued: false };
  }
}

/**
 * Push all locally queued inventory items to Supabase.
 * Items are deleted from the local queue after a successful insert.
 */
export async function flushPendingItems(familyId: string): Promise<void> {
  const pending = await getPendingItems();
  for (const item of pending) {
    if (item.family_id !== familyId) continue;
    const { error } = await supabase.from('inventory_items').insert({
      family_id:    item.family_id,
      medication_id: item.medication_id,
      custom_name:  item.custom_name,
      expiry_date:  item.expiry_date,
      quantity:     item.quantity,
      unit:         item.unit,
      lot_number:   item.lot_number,
      location:     item.location,
      added_by:     item.added_by,
    });
    if (!error) {
      await deletePendingItem(item.id);
    }
  }
}

export async function refreshInventory(familyId: string): Promise<void> {
  inventoryStore.loading.set(true);
  const { data } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('expiry_date');
  inventoryStore.loading.set(false);
  if (data) {
    const rows = data as unknown as InventoryRow[];
    inventoryStore.items.set(rows);
    // Re-schedule local notifications whenever inventory is refreshed
    void scheduleExpiryNotifications(rows).catch(() => undefined);
  }
}

function subscribeRealtime(familyId: string): void {
  channel?.unsubscribe();
  channel = supabase
    .channel(`inv:${familyId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'inventory_items',
        filter: `family_id=eq.${familyId}`,
      },
      () => {
        // Re-fetch on any change; optimized with local cache in Phase 7.
        void refreshInventory(familyId);
      },
    )
    .subscribe();
}

export function cleanupInventory(): void {
  channel?.unsubscribe();
  channel = null;
  inventoryStore.set({ items: [], familyId: null, loading: false });
}

export async function softDeleteItem(id: string): Promise<string | null> {
  const { error } = await supabase.rpc('soft_delete_inventory_item', { p_item_id: id });
  if (!error) {
    inventoryStore.items.set(inventoryStore.items.get().filter(item => item.id !== id));
  }
  return error?.message ?? null;
}

export async function logConsumption(
  itemId: string,
  qty: number,
  personName: string | null,
  notes: string | null,
): Promise<string | null> {
  const { error } = await supabase.rpc('log_consumption', {
    p_item_id:     itemId,
    p_qty:         qty,
    p_person_name: personName,
    p_notes:       notes,
  });
  if (error) return error.message;

  // Atualiza quantidade otimisticamente no store
  const items = inventoryStore.items.get();
  const idx   = items.findIndex(i => i.id === itemId);
  if (idx >= 0) {
    const current = items[idx]?.quantity ?? 0;
    inventoryStore.items[idx]?.quantity.set(Math.max(0, current - qty));
  }
  return null;
}
