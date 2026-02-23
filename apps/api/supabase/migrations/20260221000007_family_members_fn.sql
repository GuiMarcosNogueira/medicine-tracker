-- ============================================================
-- Migration 007: family management helpers
-- ============================================================

-- invited_email is optional for shareable invite links
ALTER TABLE public.family_invites
  ALTER COLUMN invited_email DROP NOT NULL;

-- Returns all members of a family together with their profile names.
-- SECURITY DEFINER is required because profiles.SELECT policy only allows
-- reading one's own profile; co-members can't read each other's rows otherwise.
CREATE OR REPLACE FUNCTION public.get_family_members(p_family_id UUID)
RETURNS TABLE(profile_id UUID, role public.family_role, full_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT fm.profile_id, fm.role, p.full_name
  FROM   public.family_members fm
  JOIN   public.profiles p ON p.id = fm.profile_id
  WHERE  fm.family_id = p_family_id
    AND  EXISTS (
           SELECT 1 FROM public.family_members auth_check
           WHERE  auth_check.family_id = p_family_id
             AND  auth_check.profile_id = auth.uid()
         )
  ORDER BY
    CASE fm.role WHEN 'owner' THEN 1 WHEN 'editor' THEN 2 ELSE 3 END,
    p.full_name;
$$;
