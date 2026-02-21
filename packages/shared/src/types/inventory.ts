export type InventoryUnit = 'un' | 'ml' | 'mg' | 'g' | 'cápsulas' | 'comprimidos';

export type ExpiryStatus = 'expired' | 'critical' | 'warning' | 'soon' | 'ok';

export interface InventoryItem {
  id: string;
  familyId: string;
  medicationId: string | null;
  customName: string | null;
  lotNumber: string | null;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  unit: InventoryUnit;
  location: string | null;
  notes: string | null;
  scannedImageUrl: string | null;
  addedBy: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}
