-- ============================================================
-- Migration 003: Full-Text Search for medications
-- ============================================================

-- ===========================
-- FTS vector generation function
-- Weights: A=product_name, B=generic_name+active_ingredient,
--          C=atc_description, D=manufacturer
-- ===========================
CREATE OR REPLACE FUNCTION public.medications_build_search_vector(
  p_product_name      TEXT,
  p_generic_name      TEXT,
  p_active_ingredient TEXT,
  p_atc_description   TEXT,
  p_manufacturer      TEXT
)
RETURNS TSVECTOR
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    setweight(to_tsvector('portuguese_unaccent', coalesce(p_product_name,      '')), 'A') ||
    setweight(to_tsvector('portuguese_unaccent', coalesce(p_generic_name,      '')), 'B') ||
    setweight(to_tsvector('portuguese_unaccent', coalesce(p_active_ingredient, '')), 'B') ||
    setweight(to_tsvector('portuguese_unaccent', coalesce(p_atc_description,   '')), 'C') ||
    setweight(to_tsvector('portuguese_unaccent', coalesce(p_manufacturer,      '')), 'D')
$$;

-- ===========================
-- Trigger to keep search_vector up-to-date
-- ===========================
CREATE OR REPLACE FUNCTION public.trg_fn_medications_fts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector = public.medications_build_search_vector(
    NEW.product_name,
    NEW.generic_name,
    NEW.active_ingredient,
    NEW.atc_description,
    NEW.manufacturer
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_medications_fts
  BEFORE INSERT OR UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.trg_fn_medications_fts();

-- ===========================
-- RPC: search_medications
-- Combines FTS ranking with ILIKE fallback for partial queries.
-- Called from the mobile app: supabase.rpc('search_medications', { query, result_limit })
-- ===========================
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

-- ===========================
-- Convenience view: expiring_soon
-- Used by Edge Function to find items needing push notifications.
-- ===========================
CREATE OR REPLACE VIEW public.expiring_soon AS
  SELECT
    ii.*,
    EXTRACT(DAY FROM (ii.expiry_date::TIMESTAMPTZ - CURRENT_DATE))::INT AS days_until_expiry
  FROM public.inventory_items ii
  WHERE
    ii.deleted_at IS NULL
    AND EXTRACT(DAY FROM (ii.expiry_date::TIMESTAMPTZ - CURRENT_DATE)) IN (30, 15, 7, 0);
