-- ============================================================
-- Migration 009: update search_medications RPC
-- Adds pharma_form_friendly, quantity_count, quantity_volume
-- to the result set (populated after re-import with parser).
-- ============================================================

-- DROP obrigatório: CREATE OR REPLACE não pode alterar RETURNS TABLE.
DROP FUNCTION IF EXISTS public.search_medications(TEXT, INT);

CREATE OR REPLACE FUNCTION public.search_medications(
  query        TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id                    UUID,
  ean                   TEXT,
  product_name          TEXT,
  generic_name          TEXT,
  active_ingredient     TEXT,
  concentration         TEXT,
  pharmaceutical_form   TEXT,
  pharma_form_friendly  TEXT,
  quantity_count        INTEGER,
  quantity_volume       TEXT,
  atc_code              TEXT,
  atc_description       TEXT,
  manufacturer          TEXT,
  reference_price       NUMERIC,
  requires_prescription BOOLEAN,
  is_controlled         BOOLEAN,
  rank                  REAL
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    m.id,
    m.ean,
    m.product_name,
    m.generic_name,
    m.active_ingredient,
    m.concentration,
    m.pharmaceutical_form,
    m.pharma_form_friendly,
    m.quantity_count,
    m.quantity_volume,
    m.atc_code,
    m.atc_description,
    m.manufacturer,
    m.reference_price,
    m.requires_prescription,
    m.is_controlled,
    ts_rank(
      m.search_vector,
      websearch_to_tsquery('portuguese_unaccent', query)
    ) AS rank
  FROM public.medications m
  WHERE
    m.search_vector @@ websearch_to_tsquery('portuguese_unaccent', query)
    OR m.product_name      ILIKE '%' || query || '%'
    OR m.active_ingredient ILIKE '%' || query || '%'
  ORDER BY
    rank DESC,
    m.product_name
  LIMIT result_limit;
$$;
