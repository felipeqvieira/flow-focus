-- Internal config table for cron-only secrets. No RLS policies = no access via API.
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role and SECURITY DEFINER functions can access.

REVOKE ALL ON public.app_config FROM anon, authenticated;

-- Reschedule cron to read secret from app_config via inline subquery (runs as superuser via cron)
DO $$
DECLARE _jobid BIGINT;
BEGIN
  SELECT jobid INTO _jobid FROM cron.job WHERE jobname = 'process-notifications-every-5min';
  IF _jobid IS NOT NULL THEN PERFORM cron.unschedule(_jobid); END IF;
END $$;

SELECT cron.schedule(
  'process-notifications-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://flowful-ai-tasks.lovable.app/api/public/hooks/notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', (SELECT value FROM public.app_config WHERE key = 'notifications_webhook_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);