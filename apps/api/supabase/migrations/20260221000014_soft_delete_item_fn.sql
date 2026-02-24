-- ============================================================
-- Migration 014: soft_delete_inventory_item RPC
--
-- Soft-deletes an inventory item by setting deleted_at.
-- Uses SECURITY DEFINER to bypass the SELECT RLS policy's
-- "deleted_at IS NULL" restriction: PostgREST checks that
-- the result of an UPDATE is still visible to the caller via
-- SELECT policies — but after a soft delete the row fails that
-- check, causing a "new row violates row-level security" error.
-- Running as the definer (postgres) sidesteps this while still
-- enforcing editor/owner membership manually.
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_inventory_item(p_item_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
BEGIN
  -- Locate the item (must exist and not already be deleted)
  SELECT family_id INTO v_family_id
  FROM public.inventory_items
  WHERE id = p_item_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found or already deleted';
  END IF;

  -- Verify the caller has editor/owner rights on this family
  IF NOT public.is_family_editor(v_family_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.inventory_items
  SET deleted_at = now()
  WHERE id = p_item_id;
END;
$$;
