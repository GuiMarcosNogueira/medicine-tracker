-- Migration 015: treatment tracking tables, RLS, and SECURITY DEFINER functions

-- ─── Treatments table ─────────────────────────────────────────────────────────

CREATE TABLE public.treatments (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id            UUID          NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  person_name          TEXT          NOT NULL,
  inventory_item_id    UUID          REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  -- Medication snapshot (frozen at creation time)
  medication_name      TEXT          NOT NULL,
  active_ingredient    TEXT,
  presentation_dosage  TEXT,
  pharma_form_friendly TEXT,
  -- Dosing
  dose_quantity        NUMERIC(10,3) NOT NULL DEFAULT 1 CHECK (dose_quantity > 0),
  dose_unit            TEXT          NOT NULL DEFAULT 'comprimido',
  frequency_hours      INTEGER       NOT NULL CHECK (frequency_hours > 0),
  -- Schedule
  start_date           DATE          NOT NULL,
  end_date             DATE,
  first_dose_time      TIME          NOT NULL,
  -- Metadata
  notes                TEXT,
  status               TEXT          NOT NULL DEFAULT 'active'
                                     CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,
  CONSTRAINT treatments_end_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX ON public.treatments (family_id) WHERE deleted_at IS NULL;
CREATE INDEX ON public.treatments (inventory_item_id) WHERE inventory_item_id IS NOT NULL;

CREATE TRIGGER set_treatments_updated_at
  BEFORE UPDATE ON public.treatments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Treatment doses table ────────────────────────────────────────────────────
-- Only stores *acted-upon* doses (taken or skipped).
-- Pending doses are computed on-the-fly from treatment schedule.

CREATE TABLE public.treatment_doses (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id      UUID          NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  scheduled_at      TIMESTAMPTZ   NOT NULL,
  status            TEXT          NOT NULL CHECK (status IN ('taken', 'skipped')),
  taken_at          TIMESTAMPTZ,
  quantity_deducted NUMERIC(10,3),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (treatment_id, scheduled_at)
);

CREATE INDEX ON public.treatment_doses (treatment_id, scheduled_at DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.treatments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_doses ENABLE ROW LEVEL SECURITY;

-- treatments
CREATE POLICY tr_member_select ON public.treatments
  FOR SELECT USING (is_family_member(family_id) AND deleted_at IS NULL);

CREATE POLICY tr_editor_insert ON public.treatments
  FOR INSERT WITH CHECK (is_family_editor(family_id));

CREATE POLICY tr_editor_update ON public.treatments
  FOR UPDATE USING (is_family_editor(family_id));

-- treatment_doses: SELECT via join; INSERT/UPDATE go through SECURITY DEFINER RPC
CREATE POLICY td_member_select ON public.treatment_doses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.treatments t
      WHERE t.id = treatment_id
        AND is_family_member(t.family_id)
        AND t.deleted_at IS NULL
    )
  );

-- ─── SECURITY DEFINER: soft_delete_treatment ─────────────────────────────────
-- Same pattern as soft_delete_inventory_item: the row becomes invisible after
-- deleted_at is set, so PostgREST would reject a direct UPDATE via RLS.

CREATE OR REPLACE FUNCTION public.soft_delete_treatment(p_treatment_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
BEGIN
  SELECT family_id INTO v_family_id
  FROM public.treatments
  WHERE id = p_treatment_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Treatment not found or already deleted';
  END IF;

  IF NOT public.is_family_editor(v_family_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  UPDATE public.treatments SET deleted_at = now() WHERE id = p_treatment_id;
END;
$$;

-- ─── SECURITY DEFINER: log_dose ───────────────────────────────────────────────
-- Logs a dose (taken/skipped) and optionally deducts from inventory.
-- Returns the new dose UUID, or NULL if the slot was already logged (idempotent).

CREATE OR REPLACE FUNCTION public.log_dose(
  p_treatment_id UUID,
  p_scheduled_at TIMESTAMPTZ,
  p_status       TEXT   -- 'taken' | 'skipped'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_treatment public.treatments%ROWTYPE;
  v_dose_id   UUID;
BEGIN
  SELECT * INTO v_treatment
  FROM public.treatments
  WHERE id = p_treatment_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Treatment not found or deleted';
  END IF;

  IF NOT public.is_family_editor(v_treatment.family_id) THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_status NOT IN ('taken', 'skipped') THEN
    RAISE EXCEPTION 'Invalid status: %', p_status;
  END IF;

  INSERT INTO public.treatment_doses (
    treatment_id,
    scheduled_at,
    status,
    taken_at,
    quantity_deducted
  ) VALUES (
    p_treatment_id,
    p_scheduled_at,
    p_status,
    CASE WHEN p_status = 'taken' THEN now() ELSE NULL END,
    CASE WHEN p_status = 'taken' THEN v_treatment.dose_quantity ELSE NULL END
  )
  ON CONFLICT (treatment_id, scheduled_at) DO NOTHING
  RETURNING id INTO v_dose_id;

  -- Deduct from inventory only on 'taken' and if linked to an inventory item
  IF p_status = 'taken'
     AND v_dose_id IS NOT NULL   -- only on first log (not a duplicate)
     AND v_treatment.inventory_item_id IS NOT NULL
  THEN
    UPDATE public.inventory_items
    SET
      quantity   = GREATEST(0, quantity - v_treatment.dose_quantity),
      updated_at = now()
    WHERE id = v_treatment.inventory_item_id
      AND deleted_at IS NULL;
  END IF;

  RETURN v_dose_id;
END;
$$;
