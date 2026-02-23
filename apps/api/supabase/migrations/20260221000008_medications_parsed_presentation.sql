-- ============================================================
-- Migration 008: parsed APRESENTAÇÃO fields on medications
-- ============================================================
-- The presentation column contains structured CMED data, e.g.:
--   "500 MG COM CT BL AL PLAS INC X 12"
-- This migration adds 4 columns populated by the import script parser.

ALTER TABLE public.medications
  ADD COLUMN IF NOT EXISTS presentation_dosage  TEXT,    -- "500 MG", "250 MG/5 ML"
  ADD COLUMN IF NOT EXISTS pharma_form_friendly TEXT,    -- "Comprimido", "Cápsula Dura"
  ADD COLUMN IF NOT EXISTS quantity_count       INTEGER, -- 30 (unit count)
  ADD COLUMN IF NOT EXISTS quantity_volume      TEXT;    -- "150 ML" (for liquids/solutions)
