// Types use snake_case to match Supabase column names directly.

export type InventoryUnit = 'un' | 'ml' | 'mg' | 'g' | 'cápsulas' | 'comprimidos';

export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'soon' | 'ok';

export interface InventoryItem {
  id: string;
  family_id: string;
  medication_id: string | null;
  custom_name: string | null;
  lot_number: string | null;
  expiry_date: string; // YYYY-MM-DD
  quantity: number;
  unit: InventoryUnit;
  location: string | null;
  notes: string | null;
  indications: string[];
  scanned_image_url: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
