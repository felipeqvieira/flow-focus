import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Flux — Organize tarefas e projetos com IA" },
      {
        name: "description",
        content:
          "Flux: gerencie tarefas e projetos em um Kanban rápido, com IA integrada para criar e organizar suas atividades por comando.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px]" />
      </div>

      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/40" />
          <span className="text-sm font-semibold tracking-tight">Flux</span>
        </div>
        <Link
          to="/login"
          className="rounded-md border border-border bg-card px-4 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          Entrar
        </Link>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 pb-20 pt-16 text-center md:pt-28">
        <span className="mb-6 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
          Em construção · Fase 1 concluída
        </span>
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
          Suas tarefas, projetos e ideias —{" "}
          <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            organizadas com IA
          </span>
          .
        </h1>
        <p className="mt-5 max-w-xl text-balance text-sm text-muted-foreground md:text-base">
          Um Kanban rápido com drag-and-drop, prazos e um chatbot que cria,
          move e prioriza tarefas por comando.
        </p>

        <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            to="/login"
            className="rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
          >
            Começar agora
          </Link>
          <a
            href="#"
            className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ver demonstração
          </a>
        </div>
      </main>
    </div>
  );
}
