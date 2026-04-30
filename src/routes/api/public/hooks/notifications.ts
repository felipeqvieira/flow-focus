import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/hooks/notifications")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Auth header is anon key from pg_cron — used to instantiate client
        const authHeader = request.headers.get("apikey");
        if (!authHeader) {
          return new Response(JSON.stringify({ error: "missing apikey" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { auth: { autoRefreshToken: false, persistSession: false } },
        );

        try {
          const [reminders, digest] = await Promise.all([
            supabase.rpc("process_task_reminders"),
            supabase.rpc("process_daily_digest"),
          ]);

          if (reminders.error) console.error("reminders error", reminders.error);
          if (digest.error) console.error("digest error", digest.error);

          return new Response(
            JSON.stringify({
              success: true,
              reminders_sent: reminders.data ?? 0,
              digests_sent: digest.data ?? 0,
              timestamp: new Date().toISOString(),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          console.error("notifications hook error", e);
          return new Response(
            JSON.stringify({ success: false, error: (e as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
