import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "invite_accepted"
  | "task_assigned"
  | "task_updated"
  | "task_due"
  | "daily_digest";

export type Notification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export async function fetchNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as Notification[];
}

export const notificationsQueryOptions = () =>
  queryOptions({
    queryKey: ["notifications"],
    queryFn: fetchNotifications,
  });

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllRead(): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) throw error;
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

// ===== Reminder offsets =====
export const REMINDER_OPTIONS: { value: number; label: string }[] = [
  { value: 60, label: "1 hora antes" },
  { value: 60 * 3, label: "3 horas antes" },
  { value: 60 * 24, label: "1 dia antes" },
  { value: 60 * 24 * 3, label: "3 dias antes" },
  { value: 60 * 24 * 7, label: "1 semana antes" },
];

export function reminderLabel(min: number): string {
  return REMINDER_OPTIONS.find((o) => o.value === min)?.label ?? `${min}min antes`;
}

// ===== User preferences =====
export type UserPreferences = {
  user_id: string;
  daily_digest_enabled: boolean;
  daily_digest_hour: number;
};

export async function fetchUserPreferences(userId: string): Promise<UserPreferences | null> {
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as UserPreferences | null;
}

export async function upsertUserPreferences(input: UserPreferences): Promise<void> {
  const { error } = await supabase.from("user_preferences").upsert(input);
  if (error) throw error;
}
