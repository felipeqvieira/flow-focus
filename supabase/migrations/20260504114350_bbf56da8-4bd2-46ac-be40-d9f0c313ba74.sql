-- Drop the overly permissive SELECT policy that exposed invitation tokens to all members
DROP POLICY IF EXISTS "Members view invitations" ON public.project_invitations;

-- Add an owner-only SELECT policy (the existing "Owners manage invitations" ALL policy
-- already covers this, but we add an explicit named policy for clarity)
CREATE POLICY "Owners view invitations"
ON public.project_invitations
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_invitations.project_id
      AND p.owner_id = auth.uid()
  )
);