-- ============================================================
-- Migration 001: Extensions e Text Search Configuration PT
-- ============================================================

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Strip diacritics/accents before full-text indexing
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Trigram similarity index (fuzzy name search, typo tolerance)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- Portuguese FTS configuration with accent stripping
-- Copies the built-in Portuguese dictionary and adds unaccent
-- so that "paracetamol" matches "Paracetamol" and
-- "acido" matches "ácido".
-- ============================================================
CREATE TEXT SEARCH CONFIGURATION portuguese_unaccent (COPY = pg_catalog.portuguese);

ALTER TEXT SEARCH CONFIGURATION portuguese_unaccent
  ALTER MAPPING FOR hword, hword_part, word
  WITH unaccent, portuguese_stem;
