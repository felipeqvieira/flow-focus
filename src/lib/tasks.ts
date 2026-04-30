import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TaskStatus = "backlog" | "todo" | "doing" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export const TASK_STATUSES: TaskStatus[] = ["backlog", "todo", "doing", "review", "done"];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "Backlog",
  todo: "A fazer",
  doing: "Fazendo",
  review: "Revisão",
  done: "Concluído",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export const PRIORITY_STYLES: Record<TaskPriority, { dot: string; badge: string; label: string }> = {
  low: {
    dot: "bg-slate-400",
    badge: "bg-slate-400/10 text-slate-300 border-slate-400/30",
    label: "Baixa",
  },
  medium: {
    dot: "bg-blue-400",
    badge: "bg-blue-400/10 text-blue-300 border-blue-400/30",
    label: "Média",
  },
  high: {
    dot: "bg-orange-400",
    badge: "bg-orange-400/10 text-orange-300 border-orange-400/30",
    label: "Alta",
  },
  urgent: {
    dot: "bg-red-500",
    badge: "bg-red-500/15 text-red-300 border-red-500/40",
    label: "Urgente",
  },
};

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
  priority: TaskPriority;
  position: number;
  due_date: string | null;
  due_time: string | null;
  archived_at: string | null;
  reminder_offsets: number[];
  reminders_sent: Record<string, string>;
  created_at: string;
  updated_at: string;
};

export type ChecklistItem = {
  id: string;
  task_id: string;
  title: string;
  is_done: boolean;
  position: number;
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

export type TaskUpdateInput = {
  id: string;
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date?: string | null;
  due_time?: string | null;
  reminder_offsets?: number[];
};

export async function updateTask(input: TaskUpdateInput): Promise<void> {
  const { id, ...patch } = input;
  const { error } = await supabase.from("tasks").update(patch).eq("id", id);
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

// ===== Checklist =====
export async function fetchChecklistByTask(taskId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from("task_checklist_items")
    .select("*")
    .eq("task_id", taskId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data as ChecklistItem[];
}

export async function createChecklistItem(input: {
  taskId: string;
  title: string;
  position: number;
}): Promise<ChecklistItem> {
  const { data, error } = await supabase
    .from("task_checklist_items")
    .insert({
      task_id: input.taskId,
      title: input.title,
      position: input.position,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ChecklistItem;
}

export async function updateChecklistItem(input: {
  id: string;
  title?: string;
  is_done?: boolean;
}): Promise<void> {
  const { id, ...patch } = input;
  const { error } = await supabase.from("task_checklist_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteChecklistItem(id: string): Promise<void> {
  const { error } = await supabase.from("task_checklist_items").delete().eq("id", id);
  if (error) throw error;
}

// Lightweight: get checklist counts for many tasks
export async function fetchChecklistCounts(
  taskIds: string[],
): Promise<Record<string, { total: number; done: number }>> {
  if (taskIds.length === 0) return {};
  const { data, error } = await supabase
    .from("task_checklist_items")
    .select("task_id, is_done")
    .in("task_id", taskIds);
  if (error) throw error;
  const result: Record<string, { total: number; done: number }> = {};
  (data ?? []).forEach((row: { task_id: string; is_done: boolean }) => {
    const r = result[row.task_id] ?? { total: 0, done: 0 };
    r.total += 1;
    if (row.is_done) r.done += 1;
    result[row.task_id] = r;
  });
  return result;
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

export const taskChecklistQueryOptions = (taskId: string) =>
  queryOptions({
    queryKey: ["checklist", taskId],
    queryFn: () => fetchChecklistByTask(taskId),
  });

export const checklistCountsQueryOptions = (taskIds: string[]) =>
  queryOptions({
    queryKey: ["checklist", "counts", [...taskIds].sort().join(",")],
    queryFn: () => fetchChecklistCounts(taskIds),
    enabled: taskIds.length > 0,
  });
