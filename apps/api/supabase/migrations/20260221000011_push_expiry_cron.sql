-- ============================================================
-- Migration 011: pg_cron — agenda diária de push notifications
-- ============================================================
--
-- Pré-requisitos (executar uma vez no Dashboard antes desta migration):
--
--   1. Habilitar pg_net: Database > Extensions > pg_net
--
--   2. Guardar a service_role_key no Vault:
--        SELECT vault.create_secret(
--          '<SUA_SERVICE_ROLE_KEY>',
--          'service_role_key',
--          'Chave do pg_cron para chamar Edge Functions'
--        );
--
--   3. Configurar a URL do projeto (Settings > Database > Configuration
--      ou via SQL):
--        ALTER DATABASE postgres
--          SET "app.settings.project_url" = 'https://<PROJECT_REF>.supabase.co';
--
-- O cron dispara diariamente às 11:00 UTC (08:00 BRT = UTC-3).
-- ============================================================

-- Helper SECURITY DEFINER: lê credenciais do Vault e dispara a Edge Function.
-- Evita expor a service_role_key no texto do cron job.
CREATE OR REPLACE FUNCTION public.invoke_push_expiry()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url TEXT;
  v_key TEXT;
BEGIN
  -- Lê a URL base do projeto (configurada como GUC no banco).
  BEGIN
    v_url := current_setting('app.settings.project_url');
  EXCEPTION WHEN OTHERS THEN
    v_url := NULL;
  END;

  IF v_url IS NULL OR v_url = '' THEN
    RAISE WARNING 'invoke_push_expiry: app.settings.project_url não configurada — abortando';
    RETURN;
  END IF;

  -- Lê a service_role_key do Supabase Vault.
  SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
   WHERE name = 'service_role_key'
   LIMIT 1;

  IF v_key IS NULL THEN
    RAISE WARNING 'invoke_push_expiry: service_role_key não encontrada no Vault — abortando';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/push-expiry',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_key
               ),
    body    := '{}'::jsonb
  );
END;
$$;

-- Remove agendamento anterior se já existir (idempotente).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-expiry-daily') THEN
    PERFORM cron.unschedule('push-expiry-daily');
  END IF;
END;
$$;

-- Agenda: diariamente às 11:00 UTC (08:00 BRT).
SELECT cron.schedule(
  'push-expiry-daily',
  '0 11 * * *',
  'SELECT public.invoke_push_expiry()'
);
