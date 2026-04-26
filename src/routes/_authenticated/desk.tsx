import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/desk")({
  component: DeskPage,
});

function DeskPage() {
  return (
    <div className="px-6 py-8 md:px-10">
      <h1 className="text-xl font-semibold tracking-tight">Meu Desk</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Visão pessoal do seu dia. Em construção — Fase 3.
      </p>
    </div>
  );
}
