// Client-side helper: fire-and-forget Google Calendar sync
import { syncTaskFn } from "@/server/googleCalendar.functions";

export function triggerGoogleSync(taskId: string, action: "upsert" | "delete" = "upsert") {
  // Fire and forget — server checks if project sync is enabled & user connected
  syncTaskFn({ data: { taskId, action } }).catch((e) => {
    // Silent fail: sync errors should not disrupt UX
    console.warn("[google-sync]", e);
  });
}
