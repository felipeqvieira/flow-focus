-- Add new values to task_status enum
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'backlog' BEFORE 'todo';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'review' BEFORE 'done';