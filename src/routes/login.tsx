import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Flux" },
      { name: "description", content: "Acesse sua conta Flux." },
    ],
  }),
  component: LoginPlaceholder,
});

function LoginPlaceholder() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">Login</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Tela de login será implementada na <strong>Fase 2</strong>.
        </p>
      </div>
    </div>
  );
}
