import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/everything")({
  component: EverythingPage,
});

function EverythingPage() {
  return (
    <div className="px-6 py-8 md:px-10">
      <h1 className="text-xl font-semibold tracking-tight">Tudo</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Kanban agregado de todos os projetos. Em construção — Fase 3.
      </p>
    </div>
  );
}
