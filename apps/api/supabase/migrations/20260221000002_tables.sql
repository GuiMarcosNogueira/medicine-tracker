-- ============================================================
-- Migration 002: Core Tables
-- ============================================================

-- ===========================
-- Helper: auto-update updated_at
-- ===========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ===========================
-- PROFILES
-- Auto-created via trigger when a user signs up in auth.users.
-- ===========================
CREATE TABLE public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: auto-create profile when auth.users row is inserted
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===========================
-- FAMILIES
-- ===========================
CREATE TABLE public.families (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_families_updated_at
  BEFORE UPDATE ON public.families
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===========================
-- FAMILY MEMBERS (join table)
-- ===========================
CREATE TYPE public.family_role AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE public.family_members (
  family_id   UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        public.family_role NOT NULL DEFAULT 'viewer',
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (family_id, profile_id)
);

CREATE INDEX idx_family_members_profile ON public.family_members(profile_id);

-- ===========================
-- FAMILY INVITES
-- ===========================
CREATE TABLE public.family_invites (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id     UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_role  public.family_role NOT NULL DEFAULT 'viewer',
  token         TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by    UUID NOT NULL REFERENCES public.profiles(id),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_family_invites_token ON public.family_invites(token);
CREATE INDEX idx_family_invites_email ON public.family_invites(invited_email);

-- ===========================
-- MEDICATION CATALOG
-- Sourced from ANVISA CMED price list (~50k presentations).
-- Global table readable by all authenticated users.
-- ===========================
CREATE TABLE public.medications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CMED / ANVISA identification
  ean                   TEXT UNIQUE,              -- EAN-13 barcode
  anvisa_code           TEXT,                    -- Registro ANVISA
  product_name          TEXT NOT NULL,           -- Nome comercial
  generic_name          TEXT,                    -- Nome genérico (DCI)
  active_ingredient     TEXT,                    -- Princípio ativo
  manufacturer          TEXT,                    -- Laboratório
  concentration         TEXT,                    -- Ex: "500mg"
  pharmaceutical_form   TEXT,                    -- Ex: "Comprimido revestido"
  route_of_admin        TEXT,                    -- Via de administração
  atc_code              TEXT,                    -- Código ATC (WHO)
  atc_description       TEXT,                    -- Descrição da classe ATC
  reference_price       NUMERIC(10,2),           -- PF 0% ICMS (CMED)
  presentation          TEXT,                    -- Ex: "100 comprimidos"
  requires_prescription BOOLEAN NOT NULL DEFAULT false,
  is_controlled         BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Full-text search vector (auto-populated by trigger in migration 003)
  search_vector         TSVECTOR
);

CREATE INDEX idx_medications_ean ON public.medications(ean) WHERE ean IS NOT NULL;
CREATE INDEX idx_medications_anvisa ON public.medications(anvisa_code) WHERE anvisa_code IS NOT NULL;
CREATE INDEX idx_medications_atc ON public.medications(atc_code) WHERE atc_code IS NOT NULL;
-- GIN index for FTS
CREATE INDEX idx_medications_search ON public.medications USING GIN(search_vector);
-- Trigram index for fuzzy name lookup
CREATE INDEX idx_medications_name_trgm ON public.medications USING GIN(product_name gin_trgm_ops);

CREATE TRIGGER trg_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===========================
-- INVENTORY ITEMS
-- Scoped to a family. Supports soft-delete for offline sync.
-- ===========================
CREATE TABLE public.inventory_items (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id         UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  medication_id     UUID REFERENCES public.medications(id) ON DELETE SET NULL,
  -- Denormalized name for items not matched to catalog
  custom_name       TEXT CHECK (char_length(custom_name) <= 200),
  lot_number        TEXT CHECK (char_length(lot_number) <= 50),
  expiry_date       DATE NOT NULL,
  quantity          NUMERIC(10,3) NOT NULL DEFAULT 1 CHECK (quantity >= 0),
  unit              TEXT NOT NULL DEFAULT 'un'
                    CHECK (unit IN ('un', 'ml', 'mg', 'g', 'cápsulas', 'comprimidos')),
  location          TEXT CHECK (char_length(location) <= 100),
  notes             TEXT CHECK (char_length(notes) <= 500),
  scanned_image_url TEXT,
  added_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ,               -- soft delete; NULL = active
  CONSTRAINT item_has_name CHECK (
    medication_id IS NOT NULL
    OR (custom_name IS NOT NULL AND custom_name <> '')
  )
);

CREATE INDEX idx_inventory_family   ON public.inventory_items(family_id)     WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_expiry   ON public.inventory_items(expiry_date)   WHERE deleted_at IS NULL;
CREATE INDEX idx_inventory_medication ON public.inventory_items(medication_id) WHERE medication_id IS NOT NULL;

CREATE TRIGGER trg_inventory_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===========================
-- DEVICE PUSH TOKENS
-- ===========================
CREATE TABLE public.device_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_device_tokens_profile ON public.device_tokens(profile_id);

CREATE TRIGGER trg_device_tokens_updated_at
  BEFORE UPDATE ON public.device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===========================
-- NOTIFICATION LOG
-- Prevents duplicate alerts for the same item+type on the same day.
-- ===========================
CREATE TABLE public.notification_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id         UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  type              TEXT NOT NULL CHECK (type IN ('expiry_30', 'expiry_15', 'expiry_7', 'expired')),
  sent_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_log_item ON public.notification_log(inventory_item_id, type);
