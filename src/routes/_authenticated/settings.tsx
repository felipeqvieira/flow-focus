import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { GoogleCalendarButton } from "@/components/google/GoogleCalendarButton";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [{ title: "Configurações — Flux" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Gerencie integrações e preferências da sua conta.
      </p>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold">Integrações</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Conecte sua conta Google para sincronizar tarefas com o Google
          Calendar. Depois de conectado, ative a sincronização individualmente
          em cada projeto.
        </p>
        <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-border bg-background/50 p-4">
          <div>
            <p className="text-sm font-medium">Google Calendar</p>
            <p className="text-xs text-muted-foreground">
              Tarefas com data viram eventos no seu Google Calendar.
            </p>
          </div>
          {user && (
            <div className="shrink-0">
              <GoogleCalendarButton userId={user.id} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
