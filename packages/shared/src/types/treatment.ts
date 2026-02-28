export type TreatmentStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type DoseStatus = 'taken' | 'skipped';

export interface Treatment {
  id: string;
  family_id: string;
  person_name: string;
  inventory_item_id: string | null;
  // Medication snapshot (frozen at creation time)
  medication_name: string;
  active_ingredient: string | null;
  presentation_dosage: string | null;
  pharma_form_friendly: string | null;
  // Dosing
  dose_quantity: number;
  dose_unit: string;
  frequency_hours: number;
  // Schedule
  start_date: string;        // YYYY-MM-DD
  end_date: string | null;
  first_dose_time: string;   // HH:MM
  // Metadata
  notes: string | null;
  status: TreatmentStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TreatmentDose {
  id: string;
  treatment_id: string;
  scheduled_at: string;      // ISO timestamp
  status: DoseStatus;
  taken_at: string | null;
  quantity_deducted: number | null;
  created_at: string;
}
