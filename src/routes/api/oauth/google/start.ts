import { createFileRoute, redirect } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { buildAuthUrl, signState } from "@/server/googleOAuth.server";

export const Route = createFileRoute("/api/oauth/google/start")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const redirectTo = url.searchParams.get("redirect") || "/";

        // Authenticate via Bearer token sent by the client
        const auth = request.headers.get("authorization") ?? "";
        const token = auth.toLowerCase().startsWith("bearer ")
          ? auth.slice(7)
          : null;
        if (!token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data.user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const state = signState({ userId: data.user.id, redirectTo });
        const authUrl = buildAuthUrl(url.origin, state);
        return Response.json({ url: authUrl });
      },
    },
  },
});
