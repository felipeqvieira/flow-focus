import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { projectQueryOptions } from "@/lib/projects";
import { projectTasksQueryOptions } from "@/lib/tasks";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InviteMembersDialog } from "@/components/projects/InviteMembersDialog";

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
  const [inviteOpen, setInviteOpen] = useState(false);

  const project = projectQuery.data;
  const isOwner = !!user && !!project && project.owner_id === user.id;

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
        <div className="ml-auto">
          {isOwner && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInviteOpen(true)}
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Convidar</span>
            </Button>
          )}
        </div>
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

      {isOwner && user && (
        <InviteMembersDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          projectId={id}
          invitedBy={user.id}
        />
      )}
    </div>
  );
}
