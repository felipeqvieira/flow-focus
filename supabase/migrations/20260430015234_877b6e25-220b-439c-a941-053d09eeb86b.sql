
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'process-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url:='https://project--735c48b4-818f-450a-862d-a2ee65b76042.lovable.app/api/public/hooks/notifications',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91emlvb2t6cWtobGRidGFlb2t5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMTA4MjYsImV4cCI6MjA5Mjc4NjgyNn0.zvBvsxAEFsXERsyT5yv1czUk-BjORVaxISkydzkciRI"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);
