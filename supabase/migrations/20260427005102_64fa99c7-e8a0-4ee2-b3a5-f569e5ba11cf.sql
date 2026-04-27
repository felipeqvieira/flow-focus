-- Add archived_at to tasks
ALTER TABLE public.tasks ADD COLUMN archived_at timestamptz;
CREATE INDEX idx_tasks_archived_at ON public.tasks(archived_at);

-- Auto-archive tasks that have been "done" for >= 7 days
CREATE OR REPLACE FUNCTION public.auto_archive_done_tasks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.tasks
  SET archived_at = now()
  WHERE status = 'done'
    AND archived_at IS NULL
    AND updated_at < now() - interval '7 days';
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;