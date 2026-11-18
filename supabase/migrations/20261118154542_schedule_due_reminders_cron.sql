-- Migration: 20261118154542_schedule_due_reminders_cron.sql
-- Description: Enable pg_cron & pg_net and schedule the send-due-reminders Edge Function every minute
--              using Supabase Vault secrets (zero hardcoded credentials) and advisory lock overlap protection.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Private schema (not exposed to PostgREST Data API)
CREATE SCHEMA IF NOT EXISTS private;

CREATE OR REPLACE FUNCTION private.invoke_send_due_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions, vault, net
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  -- Prevent overlapping cron invocations within the database transaction
  IF NOT pg_try_advisory_xact_lock(74829104) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'myday_reminder_function_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'myday_reminder_cron_secret'
  LIMIT 1;

  IF v_url IS NULL OR v_secret IS NULL THEN
    RAISE NOTICE 'MyDay reminder cron skipped: Vault secrets not yet configured.';
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_send_due_reminders() FROM PUBLIC;

-- Idempotently schedule 1-minute pg_cron job
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'myday-send-due-reminders'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'myday-send-due-reminders',
    '* * * * *',
    $job$SELECT private.invoke_send_due_reminders();$job$
  );
END $$;
