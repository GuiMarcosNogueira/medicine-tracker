-- Migration 016: registro de uso avulso de medicamentos do estoque

CREATE TABLE public.inventory_consumptions (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id      UUID          NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  family_id    UUID          NOT NULL REFERENCES public.families(id)         ON DELETE CASCADE,
  consumed_qty NUMERIC(10,3) NOT NULL CHECK (consumed_qty > 0),
  person_name  TEXT,
  notes        TEXT,
  consumed_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX ON public.inventory_consumptions (item_id,   consumed_at DESC);
CREATE INDEX ON public.inventory_consumptions (family_id, consumed_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.inventory_consumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ic_member_select ON public.inventory_consumptions
  FOR SELECT USING (is_family_member(family_id));

-- INSERT/UPDATE via SECURITY DEFINER RPC apenas

-- ── Função: log_consumption ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_consumption(
  p_item_id     UUID,
  p_qty         NUMERIC,
  p_person_name TEXT DEFAULT NULL,
  p_notes       TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_new_id    UUID;
BEGIN
  -- Buscar item e validar existência
  SELECT family_id INTO v_family_id
  FROM public.inventory_items
  WHERE id = p_item_id AND deleted_at IS NULL;

  IF v_family_id IS NULL THEN
    RAISE EXCEPTION 'item_not_found';
  END IF;

  -- Verificar permissão de editor na família
  IF NOT public.is_family_editor(v_family_id) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;

  -- Validar quantidade
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'invalid_qty';
  END IF;

  -- Decrementar estoque (nunca negativo)
  UPDATE public.inventory_items
  SET quantity = GREATEST(0, quantity - p_qty)
  WHERE id = p_item_id;

  -- Registrar consumo
  INSERT INTO public.inventory_consumptions
    (item_id, family_id, consumed_qty, person_name, notes)
  VALUES
    (p_item_id, v_family_id, p_qty, p_person_name, p_notes)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
