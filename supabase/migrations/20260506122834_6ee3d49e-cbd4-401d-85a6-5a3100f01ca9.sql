-- Reschedule the notifications cron job to use the shared webhook secret
DO $$
DECLARE
  _jobid BIGINT;
BEGIN
  SELECT jobid INTO _jobid FROM cron.job WHERE jobname = 'process-notifications-every-5min';
  IF _jobid IS NOT NULL THEN
    PERFORM cron.unschedule(_jobid);
  END IF;
END $$;

SELECT cron.schedule(
  'process-notifications-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://flowful-ai-tasks.lovable.app/api/public/hooks/notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', current_setting('app.notifications_webhook_secret', true)
    ),
    body := '{}'::jsonb
  );
  $$
);