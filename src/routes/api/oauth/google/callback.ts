import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  exchangeCodeForTokens,
  fetchGoogleEmail,
  verifyState,
} from "@/server/googleOAuth.server";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeRedirectPath(to: string): string {
  // Only allow same-origin paths
  if (typeof to !== "string") return "/";
  if (!to.startsWith("/") || to.startsWith("//")) return "/";
  return to;
}

function htmlRedirect(to: string, message: string): Response {
  const safeTo = safeRedirectPath(to);
  const safeMessage = escapeHtml(message);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${safeMessage}</title></head><body style="font-family:system-ui;padding:24px;background:#0b0b0c;color:#eee"><p>${safeMessage}</p><script>setTimeout(function(){location.replace(${JSON.stringify(safeTo)})},800)</script></body></html>`;
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/oauth/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");

        if (errorParam) {
          return htmlRedirect("/?google=error", `Conexão cancelada (${errorParam}).`);
        }
        if (!code || !state) {
          return htmlRedirect("/?google=error", "Parâmetros inválidos.");
        }

        const verified = verifyState(state);
        if (!verified) {
          return htmlRedirect("/?google=error", "State inválido ou expirado.");
        }

        try {
          const tokens = await exchangeCodeForTokens(code, url.origin);
          if (!tokens.refresh_token) {
            return htmlRedirect(
              verified.redirectTo || "/",
              "Conexão sem refresh_token. Revogue o acesso em myaccount.google.com e tente de novo.",
            );
          }
          const email = await fetchGoogleEmail(tokens.access_token);
          const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

          const { error } = await supabaseAdmin
            .from("google_calendar_connections")
            .upsert(
              {
                user_id: verified.userId,
                google_email: email,
                access_token: tokens.access_token,
                refresh_token: tokens.refresh_token,
                expires_at: expiresAt,
                scope: tokens.scope,
              },
              { onConflict: "user_id" },
            );
          if (error) throw error;

          return htmlRedirect(
            verified.redirectTo || "/?google=connected",
            "Conectado ao Google Calendar! Redirecionando...",
          );
        } catch (e) {
          console.error("google oauth callback error", e);
          return htmlRedirect("/?google=error", "Falha ao concluir conexão.");
        }
      },
    },
  },
});
