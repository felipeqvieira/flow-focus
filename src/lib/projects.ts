import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Project = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export const PROJECT_COLORS = [
  "#ef4444", // red
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#f97316", // orange
] as const;

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as Project[];
}

export async function fetchProject(id: string): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Project;
}

export async function createProject(input: {
  name: string;
  color: string;
  ownerId: string;
}): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({ name: input.name, color: input.color, owner_id: input.ownerId })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export const projectsQueryOptions = () =>
  queryOptions({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

export const projectQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["projects", id],
    queryFn: () => fetchProject(id),
  });
