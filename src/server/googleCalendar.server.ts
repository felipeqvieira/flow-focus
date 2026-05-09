// Server-only Google Calendar sync helpers.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { refreshAccessToken } from "./googleOAuth.server";

type Connection = {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

async function getValidAccessToken(userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("google_calendar_connections")
    .select("user_id, access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  const conn = data as Connection;

  // Refresh if expiring within 60s
  if (new Date(conn.expires_at).getTime() - Date.now() < 60_000) {
    try {
      const refreshed = await refreshAccessToken(conn.refresh_token);
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      await supabaseAdmin
        .from("google_calendar_connections")
        .update({
          access_token: refreshed.access_token,
          expires_at: newExpiresAt,
        })
        .eq("user_id", userId);
      return refreshed.access_token;
    } catch (e) {
      console.error("refreshAccessToken failed", e);
      return null;
    }
  }
  return conn.access_token;
}

type Task = {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  due_time: string | null;
  google_event_id: string | null;
  project_id: string;
};

function buildEventBody(task: Task) {
  if (!task.due_date) return null;
  // All-day event when no time set
  if (!task.due_time) {
    const start = task.due_date;
    const end = new Date(new Date(task.due_date).getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    return {
      summary: task.title,
      description: task.description ?? "",
      start: { date: start },
      end: { date: end },
    };
  }
  const startISO = `${task.due_date}T${task.due_time}`;
  const startMs = new Date(startISO).getTime();
  const end = new Date(startMs + 60 * 60 * 1000).toISOString();
  return {
    summary: task.title,
    description: task.description ?? "",
    start: { dateTime: new Date(startISO).toISOString() },
    end: { dateTime: end },
  };
}

const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

export async function syncTaskToGoogle(opts: {
  userId: string;
  taskId: string;
  action: "upsert" | "delete";
}): Promise<{ ok: boolean; reason?: string; eventId?: string | null }> {
  const { userId, taskId, action } = opts;

  // Load task + project to check sync flag
  const { data: task, error: taskErr } = await supabaseAdmin
    .from("tasks")
    .select(
      "id, title, description, due_date, due_time, google_event_id, project_id, archived_at, status",
    )
    .eq("id", taskId)
    .maybeSingle();
  if (taskErr || !task) return { ok: false, reason: "task_not_found" };

  // Authorization: ensure caller has access to this task's project (prevents IDOR)
  const { data: hasAccess, error: accessErr } = await supabaseAdmin.rpc(
    "user_has_project_access",
    { _user_id: userId, _project_id: task.project_id },
  );
  if (accessErr || !hasAccess) return { ok: false, reason: "forbidden" };

  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("id, google_calendar_sync_enabled")
    .eq("id", task.project_id)
    .maybeSingle();
  if (!project?.google_calendar_sync_enabled) return { ok: false, reason: "sync_disabled" };

  const accessToken = await getValidAccessToken(userId);
  if (!accessToken) return { ok: false, reason: "not_connected" };

  const existingEventId = task.google_event_id as string | null;

  // Delete path (or task archived/done -> remove from calendar)
  const shouldRemove =
    action === "delete" ||
    !!task.archived_at ||
    task.status === "done" ||
    !task.due_date;

  if (shouldRemove) {
    if (existingEventId) {
      const res = await fetch(`${CAL_BASE}/${encodeURIComponent(existingEventId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok && res.status !== 404 && res.status !== 410) {
        const txt = await res.text();
        console.error("calendar delete failed", res.status, txt);
        return { ok: false, reason: "delete_failed" };
      }
      if (action !== "delete") {
        await supabaseAdmin
          .from("tasks")
          .update({ google_event_id: null, google_event_synced_at: new Date().toISOString() })
          .eq("id", taskId);
      }
    }
    return { ok: true, eventId: null };
  }

  const body = buildEventBody(task as Task);
  if (!body) return { ok: false, reason: "no_due_date" };

  if (existingEventId) {
    const res = await fetch(`${CAL_BASE}/${encodeURIComponent(existingEventId)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 404 || res.status === 410) {
      // recreate
    } else if (!res.ok) {
      const txt = await res.text();
      console.error("calendar patch failed", res.status, txt);
      return { ok: false, reason: "patch_failed" };
    } else {
      await supabaseAdmin
        .from("tasks")
        .update({ google_event_synced_at: new Date().toISOString() })
        .eq("id", taskId);
      return { ok: true, eventId: existingEventId };
    }
  }

  const res = await fetch(CAL_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("calendar insert failed", res.status, txt);
    return { ok: false, reason: "insert_failed" };
  }
  const event = (await res.json()) as { id: string };
  await supabaseAdmin
    .from("tasks")
    .update({ google_event_id: event.id, google_event_synced_at: new Date().toISOString() })
    .eq("id", taskId);
  return { ok: true, eventId: event.id };
}
