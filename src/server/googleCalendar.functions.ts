import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { syncTaskToGoogle } from "./googleCalendar.server";

export const syncTaskFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        taskId: z.string().uuid(),
        action: z.enum(["upsert", "delete"]).default("upsert"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    return syncTaskToGoogle({
      userId: context.userId,
      taskId: data.taskId,
      action: data.action,
    });
  });

export const disconnectGoogleFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    // Best-effort revoke
    const { data: conn } = await supabase
      .from("google_calendar_connections")
      .select("refresh_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (conn?.refresh_token) {
      try {
        await fetch(
          `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(conn.refresh_token)}`,
          { method: "POST" },
        );
      } catch {
        /* ignore */
      }
    }
    const { error } = await supabase
      .from("google_calendar_connections")
      .delete()
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });
