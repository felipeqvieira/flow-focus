-- Project invitations table
CREATE TABLE public.project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.project_role NOT NULL DEFAULT 'editor',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64'),
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | revoked | expired
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid
);

CREATE INDEX idx_project_invitations_project ON public.project_invitations(project_id);
CREATE INDEX idx_project_invitations_email ON public.project_invitations(lower(email));
CREATE UNIQUE INDEX uniq_pending_invite_per_email_project
  ON public.project_invitations(project_id, lower(email))
  WHERE status = 'pending';

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

-- Owners manage invitations for their projects
CREATE POLICY "Owners manage invitations"
ON public.project_invitations
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = auth.uid()));

-- Project members can view invitations for their project
CREATE POLICY "Members view invitations"
ON public.project_invitations
FOR SELECT
TO authenticated
USING (public.user_has_project_access(auth.uid(), project_id));

-- Trigger updated_at
CREATE TRIGGER trg_project_invitations_updated_at
BEFORE UPDATE ON public.project_invitations
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Function: lookup invitation by token (security definer, bypasses RLS for unauth users)
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(_token text)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  project_name text,
  email text,
  role public.project_role,
  status text,
  expires_at timestamptz,
  invited_by_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.project_id,
    p.name AS project_name,
    i.email,
    i.role,
    CASE
      WHEN i.status = 'pending' AND i.expires_at < now() THEN 'expired'
      ELSE i.status
    END AS status,
    i.expires_at,
    pr.display_name AS invited_by_name
  FROM public.project_invitations i
  JOIN public.projects p ON p.id = i.project_id
  LEFT JOIN public.profiles pr ON pr.id = i.invited_by
  WHERE i.token = _token
  LIMIT 1;
$$;

-- Function: accept invitation
CREATE OR REPLACE FUNCTION public.accept_invitation(_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite public.project_invitations;
  _user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO _invite FROM public.project_invitations WHERE token = _token FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_found');
  END IF;

  IF _invite.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'already_' || _invite.status);
  END IF;

  IF _invite.expires_at < now() THEN
    UPDATE public.project_invitations SET status = 'expired' WHERE id = _invite.id;
    RETURN jsonb_build_object('success', false, 'error', 'expired');
  END IF;

  -- Insert as member (idempotent)
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (_invite.project_id, auth.uid(), _invite.role)
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.project_invitations
  SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
  WHERE id = _invite.id;

  RETURN jsonb_build_object('success', true, 'project_id', _invite.project_id);
END;
$$;