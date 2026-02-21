-- ============================================================
-- Migration 004: Row Level Security
-- ============================================================

-- ===========================
-- Enable RLS on all user-facing tables
-- ===========================
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_invites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_tokens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log  ENABLE ROW LEVEL SECURITY;

-- ===========================
-- Helper functions (SECURITY DEFINER avoids recursive RLS checks)
-- ===========================
CREATE OR REPLACE FUNCTION public.is_family_member(fid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = fid AND profile_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_family_editor(fid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.family_members
    WHERE family_id = fid
      AND profile_id = auth.uid()
      AND role IN ('owner', 'editor')
  );
$$;

-- ===========================
-- PROFILES
-- Users can only read/update their own profile.
-- ===========================
CREATE POLICY "profiles_self_select"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_self_update"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- ===========================
-- FAMILIES
-- ===========================
CREATE POLICY "families_member_select"
  ON public.families FOR SELECT
  USING (public.is_family_member(id));

CREATE POLICY "families_owner_insert"
  ON public.families FOR INSERT
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "families_owner_update"
  ON public.families FOR UPDATE
  USING (owner_id = auth.uid());

CREATE POLICY "families_owner_delete"
  ON public.families FOR DELETE
  USING (owner_id = auth.uid());

-- ===========================
-- FAMILY MEMBERS
-- ===========================
CREATE POLICY "fm_member_select"
  ON public.family_members FOR SELECT
  USING (public.is_family_member(family_id));

CREATE POLICY "fm_owner_insert"
  ON public.family_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.families
      WHERE id = family_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY "fm_owner_delete"
  ON public.family_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.families
      WHERE id = family_id AND owner_id = auth.uid()
    )
  );

-- ===========================
-- FAMILY INVITES
-- Editors/owners can manage invites for their family.
-- ===========================
CREATE POLICY "fi_editor_all"
  ON public.family_invites FOR ALL
  USING (public.is_family_editor(family_id))
  WITH CHECK (public.is_family_editor(family_id));

-- Allow reading an invite by its token (for deep-link acceptance)
CREATE POLICY "fi_token_select"
  ON public.family_invites FOR SELECT
  USING (true);  -- token itself is the secret; filtered in app logic

-- ===========================
-- MEDICATIONS
-- Global catalog: readable by all authenticated users.
-- Writes only via service role (import script).
-- ===========================
CREATE POLICY "medications_auth_read"
  ON public.medications FOR SELECT
  TO authenticated
  USING (true);

-- ===========================
-- INVENTORY ITEMS
-- ===========================
CREATE POLICY "inv_member_select"
  ON public.inventory_items FOR SELECT
  USING (
    public.is_family_member(family_id)
    AND deleted_at IS NULL
  );

CREATE POLICY "inv_editor_insert"
  ON public.inventory_items FOR INSERT
  WITH CHECK (public.is_family_editor(family_id));

CREATE POLICY "inv_editor_update"
  ON public.inventory_items FOR UPDATE
  USING (public.is_family_editor(family_id));

CREATE POLICY "inv_editor_delete"
  ON public.inventory_items FOR DELETE
  USING (public.is_family_editor(family_id));

-- ===========================
-- DEVICE TOKENS
-- Each user manages only their own tokens.
-- ===========================
CREATE POLICY "dt_self_all"
  ON public.device_tokens FOR ALL
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- ===========================
-- NOTIFICATION LOG
-- Family members can read notification history.
-- ===========================
CREATE POLICY "nl_family_member_select"
  ON public.notification_log FOR SELECT
  USING (public.is_family_member(family_id));
