// Types use snake_case to match Supabase column names directly.

export interface Medication {
  id: string;
  ean: string | null;
  anvisa_code: string | null;
  product_name: string;
  generic_name: string | null;
  active_ingredient: string | null;
  manufacturer: string | null;
  concentration: string | null;
  pharmaceutical_form: string | null;
  route_of_admin: string | null;
  atc_code: string | null;
  atc_description: string | null;
  reference_price: number | null;
  presentation: string | null;
  presentation_dosage: string | null;
  pharma_form_friendly: string | null;
  quantity_count: number | null;
  quantity_volume: string | null;
  requires_prescription: boolean;
  is_controlled: boolean;
  created_at: string;
  updated_at: string;
}

export interface MedicationSearchResult {
  id: string;
  ean: string | null;
  product_name: string;
  generic_name: string | null;
  active_ingredient: string | null;
  concentration: string | null;
  pharmaceutical_form: string | null;
  presentation_dosage: string | null;
  pharma_form_friendly: string | null;
  quantity_count: number | null;
  quantity_volume: string | null;
  atc_code: string | null;
  atc_description: string | null;
  manufacturer: string | null;
  reference_price: number | null;
  requires_prescription: boolean;
  is_controlled: boolean;
  rank: number;
}
