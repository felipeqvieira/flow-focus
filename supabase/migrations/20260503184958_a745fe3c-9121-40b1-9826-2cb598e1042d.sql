
-- Tokens do Google Calendar por usuário
CREATE TABLE public.google_calendar_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  google_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own google connection"
  ON public.google_calendar_connections FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own google connection"
  ON public.google_calendar_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own google connection"
  ON public.google_calendar_connections FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own google connection"
  ON public.google_calendar_connections FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER set_google_calendar_connections_updated_at
  BEFORE UPDATE ON public.google_calendar_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Toggle por projeto
ALTER TABLE public.projects
  ADD COLUMN google_calendar_sync_enabled BOOLEAN NOT NULL DEFAULT false;

-- Rastreamento do evento por tarefa
ALTER TABLE public.tasks
  ADD COLUMN google_event_id TEXT,
  ADD COLUMN google_event_synced_at TIMESTAMPTZ;
