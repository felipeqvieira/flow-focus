-- Priority enum + column on tasks
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

ALTER TABLE public.tasks
  ADD COLUMN priority public.task_priority NOT NULL DEFAULT 'medium';

-- Checklist items
CREATE TABLE public.task_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  position double precision NOT NULL DEFAULT 1000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_checklist_task_id ON public.task_checklist_items(task_id);

ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View checklist of accessible tasks"
ON public.task_checklist_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.id = task_checklist_items.task_id
    AND public.user_has_project_access(auth.uid(), t.project_id)
));

CREATE POLICY "Insert checklist in accessible tasks"
ON public.task_checklist_items FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.id = task_checklist_items.task_id
    AND public.user_has_project_access(auth.uid(), t.project_id)
));

CREATE POLICY "Update checklist in accessible tasks"
ON public.task_checklist_items FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.id = task_checklist_items.task_id
    AND public.user_has_project_access(auth.uid(), t.project_id)
));

CREATE POLICY "Delete checklist in accessible tasks"
ON public.task_checklist_items FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.tasks t
  WHERE t.id = task_checklist_items.task_id
    AND public.user_has_project_access(auth.uid(), t.project_id)
));

CREATE TRIGGER set_checklist_updated_at
BEFORE UPDATE ON public.task_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();