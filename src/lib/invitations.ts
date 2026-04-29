import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProjectRole = "editor" | "viewer";

export type ProjectInvitation = {
  id: string;
  project_id: string;
  email: string;
  role: ProjectRole;
  token: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  invited_by: string;
  expires_at: string;
  created_at: string;
};

export type InvitationByToken = {
  id: string;
  project_id: string;
  project_name: string;
  email: string;
  role: ProjectRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  invited_by_name: string | null;
};

export async function fetchProjectInvitations(projectId: string): Promise<ProjectInvitation[]> {
  const { data, error } = await supabase
    .from("project_invitations")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ProjectInvitation[];
}

export const projectInvitationsQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: ["project-invitations", projectId],
    queryFn: () => fetchProjectInvitations(projectId),
  });

export async function createInvitation(input: {
  projectId: string;
  email: string;
  role: ProjectRole;
  invitedBy: string;
}): Promise<ProjectInvitation> {
  const { data, error } = await supabase
    .from("project_invitations")
    .insert({
      project_id: input.projectId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      invited_by: input.invitedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ProjectInvitation;
}

export async function revokeInvitation(id: string): Promise<void> {
  const { error } = await supabase
    .from("project_invitations")
    .update({ status: "revoked" })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchInvitationByToken(token: string): Promise<InvitationByToken | null> {
  const { data, error } = await supabase.rpc("get_invitation_by_token", { _token: token });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as InvitationByToken) ?? null;
}

export async function acceptInvitation(token: string): Promise<{ success: boolean; project_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc("accept_invitation", { _token: token });
  if (error) throw error;
  return data as { success: boolean; project_id?: string; error?: string };
}

export function buildInviteUrl(token: string): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/invite/${encodeURIComponent(token)}`;
}
