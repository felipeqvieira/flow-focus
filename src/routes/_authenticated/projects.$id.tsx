import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  return (
    <div className="px-6 py-8 md:px-10">
      <h1 className="text-xl font-semibold tracking-tight">Projeto {id}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Kanban do projeto. Em construção — Fase 3 / 4.
      </p>
    </div>
  );
}
