-- ============================================================
-- Migration 010: invite acceptance helpers
-- ============================================================

-- get_invite_info: returns invite + family details for a token.
-- Requires authentication; token is the only secret needed.
CREATE OR REPLACE FUNCTION public.get_invite_info(p_token TEXT)
RETURNS TABLE (
  family_id    UUID,
  family_name  TEXT,
  invited_role public.family_role,
  expires_at   TIMESTAMPTZ,
  is_valid     BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    f.id            AS family_id,
    f.name          AS family_name,
    fi.invited_role,
    fi.expires_at,
    (fi.accepted_at IS NULL AND fi.expires_at > now()) AS is_valid
  FROM public.family_invites fi
  JOIN public.families f ON f.id = fi.family_id
  WHERE fi.token = p_token
    AND auth.uid() IS NOT NULL
  LIMIT 1;
$$;

-- accept_invite: validates token and adds the caller to the family.
-- Returns the family_id so the client can initialise the inventory store.
-- Idempotent: if the caller is already a member, returns family_id without error.
CREATE OR REPLACE FUNCTION public.accept_invite(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id   UUID;
  v_role        public.family_role;
  v_user_id     UUID;
  v_expires_at  TIMESTAMPTZ;
  v_accepted_at TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT fi.family_id, fi.invited_role, fi.expires_at, fi.accepted_at
    INTO v_family_id, v_role, v_expires_at, v_accepted_at
    FROM public.family_invites fi
   WHERE fi.token = p_token;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado';
  END IF;

  IF v_accepted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Este convite já foi utilizado';
  END IF;

  IF v_expires_at < now() THEN
    RAISE EXCEPTION 'Este convite expirou';
  END IF;

  -- Already a member → idempotent success
  IF EXISTS (
    SELECT 1 FROM public.family_members
     WHERE family_id = v_family_id AND profile_id = v_user_id
  ) THEN
    RETURN v_family_id;
  END IF;

  INSERT INTO public.family_members (family_id, profile_id, role)
  VALUES (v_family_id, v_user_id, v_role);

  UPDATE public.family_invites
     SET accepted_at = now()
   WHERE token = p_token;

  RETURN v_family_id;
END;
$$;
