-- Add therapeutic indications to inventory items.
-- Stored as a text array so users can tag each item with symptoms/conditions
-- the medication treats (e.g. ["Febre", "Dor de Cabeça"]).
-- Populated automatically via the get-indications Edge Function when an item
-- is added from the catalog; can also be edited manually.

ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS indications TEXT[] NOT NULL DEFAULT '{}';
