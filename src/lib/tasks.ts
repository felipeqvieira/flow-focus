import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "backlog" | "todo" | "doing" | "review" | "done";

export const TASK_STATUSES: TaskStatus[] = ["backlog", "todo", "doing", "review", "done"];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "A fazer",
  doing: "Fazendo",
  review: "Revisão",
  done: "Concluído",
};

// Subtle column accent colors (border + header tint). Uses semantic-ish hues.
export const STATUS_COLORS: Record<
  TaskStatus,
  { dot: string; border: string; headerBg: string; headerText: string }
> = {
  backlog: {
    dot: "bg-zinc-400",
    border: "border-t-zinc-400/70",
    headerBg: "bg-zinc-400/10",
    headerText: "text-zinc-300",
  },
  todo: {
    dot: "bg-sky-400",
    border: "border-t-sky-400/70",
    headerBg: "bg-sky-400/10",
    headerText: "text-sky-300",
  },
  doing: {
    dot: "bg-amber-400",
    border: "border-t-amber-400/70",
    headerBg: "bg-amber-400/10",
    headerText: "text-amber-300",
  },
  review: {
    dot: "bg-violet-400",
    border: "border-t-violet-400/70",
    headerBg: "bg-violet-400/10",
    headerText: "text-violet-300",
  },
  done: {
    dot: "bg-emerald-400",
    border: "border-t-emerald-400/70",
    headerBg: "bg-emerald-400/10",
    headerText: "text-emerald-300",
  },
};

export type Task = {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  position: number;
  due_date: string | null;
  due_time: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function fetchTasksByProject(projectId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Task[];
}

export async function fetchAllTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("position", { ascending: true });
  if (error) throw error;
  return data as Task[];
}

export async function createTask(input: {
  title: string;
  projectId: string;
  status: TaskStatus;
  createdBy: string;
  position: number;
}): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      project_id: input.projectId,
      status: input.status,
      created_by: input.createdBy,
      position: input.position,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Task;
}

export async function updateTaskPosition(input: {
  id: string;
  status: TaskStatus;
  position: number;
}): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: input.status, position: input.position })
    .eq("id", input.id);
  if (error) throw error;
}

export async function archiveTask(id: string): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function unarchiveTask(id: string): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ archived_at: null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export const projectTasksQueryOptions = (projectId: string) =>
  queryOptions({
    queryKey: ["tasks", "project", projectId],
    queryFn: () => fetchTasksByProject(projectId),
  });

export const allTasksQueryOptions = () =>
  queryOptions({
    queryKey: ["tasks", "all"],
    queryFn: fetchAllTasks,
  });
