-- ============================================================
-- Migration 006: create_family_with_owner RPC
--
-- Creates a family and immediately adds the calling user as
-- owner in a single atomic transaction, bypassing RLS via
-- SECURITY DEFINER. This avoids two issues:
--   1. The families INSERT RLS check can fail on web OAuth
--      sessions where auth.uid() isn't resolved in PostgREST.
--   2. The family_members INSERT policy (fm_owner_insert) does
--      a SELECT on families filtered by families_member_select,
--      which uses is_family_member() — but the member row
--      doesn't exist yet, creating a circular dependency.
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_family_with_owner(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_user_id   UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.families (name, owner_id)
  VALUES (p_name, v_user_id)
  RETURNING id INTO v_family_id;

  INSERT INTO public.family_members (family_id, profile_id, role)
  VALUES (v_family_id, v_user_id, 'owner');

  RETURN v_family_id;
END;
$$;
