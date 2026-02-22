// Web platform implementation of local-db.
// expo-sqlite is native-only; Metro resolves this file instead on web.
// Medications are kept in an in-memory array (refreshed on each Supabase query).
// Pending offline items are persisted via localStorage.
import type { MedicationSearchResult } from '@medstock/shared';

// In-memory medication cache — survives re-renders, lost on page refresh (acceptable).
const medicationsCache: MedicationSearchResult[] = [];

// Exported to satisfy the native module interface; not used externally on web.
export async function initLocalDb(): Promise<unknown> {
  return null;
}

export async function cacheMedicationResults(results: MedicationSearchResult[]): Promise<void> {
  for (const r of results) {
    const idx = medicationsCache.findIndex(m => m.id === r.id);
    if (idx >= 0) medicationsCache[idx] = r;
    else medicationsCache.push(r);
  }
}

export async function localSearchMedications(query: string): Promise<MedicationSearchResult[]> {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return medicationsCache
    .filter(
      m =>
        m.product_name.toLowerCase().includes(q) ||
        (m.active_ingredient ?? '').toLowerCase().includes(q) ||
        (m.generic_name ?? '').toLowerCase().includes(q),
    )
    .slice(0, 20);
}

// Re-export the interface so inventory.store.ts can import it from this file on web.
export interface PendingInventoryItem {
  id: string;
  family_id: string;
  medication_id: string | null;
  custom_name: string | null;
  expiry_date: string;
  quantity: number;
  unit: string;
  lot_number: string | null;
  location: string | null;
  added_by: string | null;
  created_at: string;
}

const PENDING_KEY = 'medstock_pending_items';

function loadFromStorage(): PendingInventoryItem[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingInventoryItem[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: PendingInventoryItem[]): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PENDING_KEY, JSON.stringify(items));
  }
}

export async function savePendingItem(item: PendingInventoryItem): Promise<void> {
  const items = loadFromStorage();
  const idx = items.findIndex(i => i.id === item.id);
  if (idx >= 0) items[idx] = item;
  else items.push(item);
  saveToStorage(items);
}

export async function getPendingItems(): Promise<PendingInventoryItem[]> {
  return loadFromStorage();
}

export async function deletePendingItem(id: string): Promise<void> {
  saveToStorage(loadFromStorage().filter(i => i.id !== id));
}
