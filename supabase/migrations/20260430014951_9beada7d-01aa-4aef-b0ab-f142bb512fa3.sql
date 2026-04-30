
REVOKE EXECUTE ON FUNCTION public.notify_task_created() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_task_updated() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.notify_invitation_accepted() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.process_task_reminders() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.process_daily_digest() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.process_task_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.process_daily_digest() TO service_role;
