import { observable } from '@legendapp/state';
import { supabase } from '../lib/supabase';
import type { InventoryUnit } from '@medstock/shared';

// Inventory item with joined medication data
export interface InventoryRow {
  id: string;
  family_id: string;
  medication_id: string | null;
  custom_name: string | null;
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
  // Joined from medications table
  medications: {
    product_name: string;
    active_ingredient: string | null;
    pharmaceutical_form: string | null;
  } | null;
}

export const inventoryStore = observable<{
  items: InventoryRow[];
  familyId: string | null;
  loading: boolean;
}>({ items: [], familyId: null, loading: false });

let channel: ReturnType<typeof supabase.channel> | null = null;

export function getItemDisplayName(item: Pick<InventoryRow, 'medications' | 'custom_name'>): string {
  return item.medications?.product_name ?? item.custom_name ?? 'Sem nome';
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
  await refreshInventory(fid);
  subscribeRealtime(fid);
}

export async function refreshInventory(familyId: string): Promise<void> {
  inventoryStore.loading.set(true);
  const { data } = await supabase
    .from('inventory_items')
    .select('*, medications(product_name, active_ingredient, pharmaceutical_form)')
    .eq('family_id', familyId)
    .is('deleted_at', null)
    .order('expiry_date');
  inventoryStore.loading.set(false);
  if (data) {
    inventoryStore.items.set(data as unknown as InventoryRow[]);
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
  const { error } = await supabase
    .from('inventory_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  return error?.message ?? null;
}
