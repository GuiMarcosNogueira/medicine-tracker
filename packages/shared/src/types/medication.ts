export interface Medication {
  id: string;
  ean: string | null;
  anvisaCode: string | null;
  productName: string;
  genericName: string | null;
  activeIngredient: string | null;
  manufacturer: string | null;
  concentration: string | null;
  pharmaceuticalForm: string | null;
  routeOfAdmin: string | null;
  atcCode: string | null;
  atcDescription: string | null;
  referencePrice: number | null;
  presentation: string | null;
  requiresPrescription: boolean;
  isControlled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationSearchResult {
  id: string;
  ean: string | null;
  productName: string;
  genericName: string | null;
  activeIngredient: string | null;
  concentration: string | null;
  pharmaceuticalForm: string | null;
  atcCode: string | null;
  atcDescription: string | null;
  manufacturer: string | null;
  referencePrice: number | null;
  requiresPrescription: boolean;
  isControlled: boolean;
  rank: number;
}
