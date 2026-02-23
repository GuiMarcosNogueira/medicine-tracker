-- ============================================================
-- Migration 013: snapshot columns for inventory_items
-- ============================================================
-- Denormalise medication metadata directly into inventory_items
-- so that:
--   a) Items are self-contained (no JOIN required for display).
--   b) Custom (avulso) items can carry the same descriptive info.
--   c) The snapshot reflects the catalog data at add-time, not
--      whatever the catalog row looks like today.
-- ============================================================

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS product_name        TEXT,
  ADD COLUMN IF NOT EXISTS manufacturer        TEXT,
  ADD COLUMN IF NOT EXISTS active_ingredient   TEXT,
  ADD COLUMN IF NOT EXISTS presentation_dosage TEXT,
  ADD COLUMN IF NOT EXISTS pharma_form_friendly TEXT,
  ADD COLUMN IF NOT EXISTS pharmaceutical_form TEXT;
