
-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL, -- 'invite_accepted' | 'task_assigned' | 'task_updated' | 'task_due' | 'daily_digest'
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, read_at, created_at DESC);

-- User preferences for daily digest
CREATE TABLE public.user_preferences (
  user_id UUID PRIMARY KEY,
  daily_digest_enabled BOOLEAN NOT NULL DEFAULT true,
  daily_digest_hour INT NOT NULL DEFAULT 8, -- 0..23
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own preferences" ON public.user_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reminder offsets per task (minutes before due)
ALTER TABLE public.tasks
  ADD COLUMN reminder_offsets INT[] NOT NULL DEFAULT '{}',
  ADD COLUMN reminders_sent JSONB NOT NULL DEFAULT '{}'::jsonb;
-- reminders_sent: { "60": "2026-04-30T...", "1440": "..." }  -- offset(min) -> sent_at

-- Trigger: notify members on new task in shared projects
CREATE OR REPLACE FUNCTION public.notify_task_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_name TEXT;
  _owner_id UUID;
BEGIN
  SELECT name, owner_id INTO _project_name, _owner_id FROM public.projects WHERE id = NEW.project_id;

  -- Notify owner (if creator isn't owner)
  IF _owner_id IS NOT NULL AND _owner_id <> NEW.created_by THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (_owner_id, 'task_assigned',
      'Nova tarefa em ' || _project_name,
      NEW.title,
      '/projects/' || NEW.project_id,
      jsonb_build_object('task_id', NEW.id, 'project_id', NEW.project_id));
  END IF;

  -- Notify other members (excluding creator)
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT pm.user_id, 'task_assigned',
    'Nova tarefa em ' || _project_name,
    NEW.title,
    '/projects/' || NEW.project_id,
    jsonb_build_object('task_id', NEW.id, 'project_id', NEW.project_id)
  FROM public.project_members pm
  WHERE pm.project_id = NEW.project_id AND pm.user_id <> NEW.created_by;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_created
  AFTER INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_created();

-- Trigger: notify on task status change in shared projects
CREATE OR REPLACE FUNCTION public.notify_task_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_name TEXT;
  _owner_id UUID;
  _actor UUID := auth.uid();
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT name, owner_id INTO _project_name, _owner_id FROM public.projects WHERE id = NEW.project_id;

  -- Owner
  IF _owner_id IS NOT NULL AND _owner_id <> COALESCE(_actor, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (_owner_id, 'task_updated',
      'Tarefa atualizada em ' || _project_name,
      NEW.title || ' → ' || NEW.status,
      '/projects/' || NEW.project_id,
      jsonb_build_object('task_id', NEW.id, 'project_id', NEW.project_id, 'status', NEW.status));
  END IF;

  -- Members
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  SELECT pm.user_id, 'task_updated',
    'Tarefa atualizada em ' || _project_name,
    NEW.title || ' → ' || NEW.status,
    '/projects/' || NEW.project_id,
    jsonb_build_object('task_id', NEW.id, 'project_id', NEW.project_id, 'status', NEW.status)
  FROM public.project_members pm
  WHERE pm.project_id = NEW.project_id
    AND pm.user_id <> COALESCE(_actor, '00000000-0000-0000-0000-000000000000'::uuid);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_task_updated
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_updated();

-- Trigger: notify owner when invitation is accepted
CREATE OR REPLACE FUNCTION public.notify_invitation_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _project_name TEXT;
  _accepter_name TEXT;
BEGIN
  IF NEW.status = 'accepted' AND OLD.status <> 'accepted' THEN
    SELECT name INTO _project_name FROM public.projects WHERE id = NEW.project_id;
    SELECT display_name INTO _accepter_name FROM public.profiles WHERE id = NEW.accepted_by;

    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (NEW.invited_by, 'invite_accepted',
      'Convite aceito',
      COALESCE(_accepter_name, NEW.email) || ' entrou em ' || _project_name,
      '/projects/' || NEW.project_id,
      jsonb_build_object('project_id', NEW.project_id, 'invitation_id', NEW.id));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_invitation_accepted
  AFTER UPDATE ON public.project_invitations
  FOR EACH ROW EXECUTE FUNCTION public.notify_invitation_accepted();

-- Function for cron: process due-date reminders
CREATE OR REPLACE FUNCTION public.process_task_reminders()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _task RECORD;
  _offset INT;
  _due_ts TIMESTAMPTZ;
  _trigger_at TIMESTAMPTZ;
  _now TIMESTAMPTZ := now();
  _project_name TEXT;
  _user_id UUID;
  _count INT := 0;
BEGIN
  FOR _task IN
    SELECT t.*, p.name AS project_name, p.owner_id
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    WHERE t.due_date IS NOT NULL
      AND t.archived_at IS NULL
      AND t.status <> 'done'
      AND array_length(t.reminder_offsets, 1) > 0
  LOOP
    _due_ts := (_task.due_date::timestamp + COALESCE(_task.due_time, '23:59'::time))::timestamptz;

    FOREACH _offset IN ARRAY _task.reminder_offsets
    LOOP
      _trigger_at := _due_ts - make_interval(mins => _offset);

      -- Already sent?
      IF (_task.reminders_sent ? _offset::text) THEN
        CONTINUE;
      END IF;

      -- Time to fire?
      IF _trigger_at <= _now AND _due_ts >= _now - interval '1 day' THEN
        -- Notify owner + members
        FOR _user_id IN
          SELECT _task.owner_id
          UNION
          SELECT user_id FROM public.project_members WHERE project_id = _task.project_id
        LOOP
          INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
          VALUES (_user_id, 'task_due',
            'Tarefa vencendo: ' || _task.title,
            'Vence em ' || _task.project_name,
            '/projects/' || _task.project_id,
            jsonb_build_object('task_id', _task.id, 'project_id', _task.project_id, 'offset_min', _offset));
          _count := _count + 1;
        END LOOP;

        UPDATE public.tasks
        SET reminders_sent = reminders_sent || jsonb_build_object(_offset::text, _now::text)
        WHERE id = _task.id;
      END IF;
    END LOOP;
  END LOOP;

  RETURN _count;
END;
$$;

-- Function for cron: daily digest
CREATE OR REPLACE FUNCTION public.process_daily_digest()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user RECORD;
  _today DATE := (now() AT TIME ZONE 'UTC')::date;
  _count_today INT;
  _count_overdue INT;
  _count INT := 0;
BEGIN
  FOR _user IN
    SELECT up.user_id, up.daily_digest_hour
    FROM public.user_preferences up
    WHERE up.daily_digest_enabled = true
      AND up.daily_digest_hour = EXTRACT(HOUR FROM now())::int
  LOOP
    -- Skip if already sent today
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = _user.user_id
        AND type = 'daily_digest'
        AND created_at::date = _today
    ) THEN CONTINUE; END IF;

    SELECT COUNT(*) INTO _count_today
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    LEFT JOIN public.project_members pm ON pm.project_id = p.id AND pm.user_id = _user.user_id
    WHERE (p.owner_id = _user.user_id OR pm.user_id IS NOT NULL)
      AND t.archived_at IS NULL AND t.status <> 'done'
      AND t.due_date = _today;

    SELECT COUNT(*) INTO _count_overdue
    FROM public.tasks t
    JOIN public.projects p ON p.id = t.project_id
    LEFT JOIN public.project_members pm ON pm.project_id = p.id AND pm.user_id = _user.user_id
    WHERE (p.owner_id = _user.user_id OR pm.user_id IS NOT NULL)
      AND t.archived_at IS NULL AND t.status <> 'done'
      AND t.due_date < _today;

    IF _count_today + _count_overdue > 0 THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (_user.user_id, 'daily_digest',
        'Bom dia! Seu resumo do dia',
        _count_today || ' tarefa(s) para hoje, ' || _count_overdue || ' atrasada(s)',
        '/desk',
        jsonb_build_object('today', _count_today, 'overdue', _count_overdue));
      _count := _count + 1;
    END IF;
  END LOOP;

  RETURN _count;
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
