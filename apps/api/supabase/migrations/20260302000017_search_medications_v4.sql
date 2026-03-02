-- Migration 017: ampliar busca para incluir dosagem e quantidade
-- Adiciona ILIKE em concentration, presentation_dosage, quantity_count e
-- quantity_volume, permitindo buscas como "500mg", "30 comprimidos", "150ml".

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
  presentation_dosage   TEXT,
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
    m.presentation_dosage,
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
    OR m.product_name        ILIKE '%' || query || '%'
    OR m.active_ingredient   ILIKE '%' || query || '%'
    OR m.concentration       ILIKE '%' || query || '%'
    OR m.presentation_dosage ILIKE '%' || query || '%'
    OR m.quantity_count::TEXT ILIKE '%' || query || '%'
    OR m.quantity_volume     ILIKE '%' || query || '%'
  ORDER BY
    rank DESC,
    m.product_name
  LIMIT result_limit;
$$;
