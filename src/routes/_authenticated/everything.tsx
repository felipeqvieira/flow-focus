import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { projectsQueryOptions } from "@/lib/projects";
import { allTasksQueryOptions } from "@/lib/tasks";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/everything")({
  loader: ({ context: { queryClient } }) => {
    queryClient.ensureQueryData(projectsQueryOptions());
    queryClient.ensureQueryData(allTasksQueryOptions());
  },
  component: EverythingPage,
});

function EverythingPage() {
  const { user } = useAuth();
  const projectsQuery = useQuery(projectsQueryOptions());
  const tasksQuery = useQuery(allTasksQueryOptions());

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4 md:px-6">
        <h1 className="text-lg font-semibold tracking-tight">Tudo</h1>
        <p className="text-xs text-muted-foreground">
          Visão agregada de todos os projetos
        </p>
      </div>

      {user && projectsQuery.data && tasksQuery.data && (
        <div className="flex-1 overflow-hidden">
          {projectsQuery.data.length === 0 ? (
            <div className="px-4 text-sm text-muted-foreground md:px-6">
              Crie um projeto na barra lateral para começar.
            </div>
          ) : (
            <KanbanBoard
              tasks={tasksQuery.data}
              projects={projectsQuery.data}
              showProjectTag
              currentUserId={user.id}
              invalidateKeys={[["tasks", "all"]]}
            />
          )}
        </div>
      )}
    </div>
  );
}
