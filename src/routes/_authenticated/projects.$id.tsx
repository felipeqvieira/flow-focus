import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { projectQueryOptions } from "@/lib/projects";
import { projectTasksQueryOptions } from "@/lib/tasks";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  loader: ({ params, context: { queryClient } }) => {
    queryClient.ensureQueryData(projectQueryOptions(params.id));
    queryClient.ensureQueryData(projectTasksQueryOptions(params.id));
  },
  component: ProjectPage,
});

function ProjectPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const projectQuery = useQuery(projectQueryOptions(id));
  const tasksQuery = useQuery(projectTasksQueryOptions(id));

  const project = projectQuery.data;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 py-4 md:px-6">
        <Link
          to="/everything"
          className="rounded-md p-1 text-muted-foreground hover:bg-accent md:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        {project && (
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: project.color }}
          />
        )}
        <h1 className="text-lg font-semibold tracking-tight">
          {project?.name ?? "Carregando..."}
        </h1>
      </div>

      {user && project && tasksQuery.data && (
        <div className="flex-1 overflow-hidden">
          <KanbanBoard
            tasks={tasksQuery.data}
            projects={[project]}
            defaultProjectId={id}
            currentUserId={user.id}
            invalidateKeys={[
              ["tasks", "project", id],
              ["tasks", "all"],
            ]}
          />
        </div>
      )}
    </div>
  );
}
