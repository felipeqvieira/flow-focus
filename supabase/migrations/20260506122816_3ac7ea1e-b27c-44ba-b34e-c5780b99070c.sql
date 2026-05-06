-- Fix RLS: restrict project_invitations SELECT policy from public to authenticated
DROP POLICY IF EXISTS "Owners view invitations" ON public.project_invitations;

CREATE POLICY "Owners view invitations"
ON public.project_invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_invitations.project_id
      AND p.owner_id = auth.uid()
  )
);