-- Migration 018: converter gotas → mL na dedução do estoque em log_dose
-- 1 gota = 0,05 mL (20 gotas = 1 mL — padrão farmacêutico brasileiro)

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
  v_treatment  public.treatments%ROWTYPE;
  v_dose_id    UUID;
  v_deduct_qty NUMERIC;
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

  -- Deduzir do estoque somente em 'taken' e quando vinculado a um item
  IF p_status = 'taken'
     AND v_dose_id IS NOT NULL
     AND v_treatment.inventory_item_id IS NOT NULL
  THEN
    -- Gotas: 1 gota = 0,05 mL (20 gotas = 1 mL)
    v_deduct_qty := CASE
      WHEN v_treatment.dose_unit = 'gotas'
        THEN v_treatment.dose_quantity * 0.05
      ELSE v_treatment.dose_quantity
    END;

    UPDATE public.inventory_items
    SET
      quantity   = GREATEST(0, quantity - v_deduct_qty),
      updated_at = now()
    WHERE id = v_treatment.inventory_item_id
      AND deleted_at IS NULL;
  END IF;

  RETURN v_dose_id;
END;
$$;
