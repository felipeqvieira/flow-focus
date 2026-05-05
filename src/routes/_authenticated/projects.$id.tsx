import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { deleteProject, projectQueryOptions, updateProjectSync } from "@/lib/projects";
import { projectTasksQueryOptions } from "@/lib/tasks";
import { KanbanBoard } from "@/components/kanban/KanbanBoard";
import { useAuth } from "@/hooks/use-auth";
import { ArrowLeft, Calendar, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { InviteMembersDialog } from "@/components/projects/InviteMembersDialog";
import { supabase } from "@/integrations/supabase/client";

async function fetchOwnConnection(userId: string) {
  const { data } = await supabase
    .from("google_calendar_connections")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

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
  const qc = useQueryClient();
  const projectQuery = useQuery(projectQueryOptions(id));
  const tasksQuery = useQuery(projectTasksQueryOptions(id));
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const project = projectQuery.data;
  const isOwner = !!user && !!project && project.owner_id === user.id;

  const connQuery = useQuery({
    queryKey: ["google-conn", user?.id],
    queryFn: () => fetchOwnConnection(user!.id),
    enabled: !!user,
  });

  const syncMutation = useMutation({
    mutationFn: (enabled: boolean) => updateProjectSync(id, enabled),
    onSuccess: (_d, enabled) => {
      qc.invalidateQueries({ queryKey: ["projects", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(enabled ? "Sincronização ativada" : "Sincronização desativada");
    },
    onError: () => toast.error("Erro ao atualizar sincronização"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteProject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projeto removido");
      navigate({ to: "/everything" });
    },
    onError: () => toast.error("Erro ao remover projeto"),
  });

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
        <div className="ml-auto flex items-center gap-2">
          {isOwner && project && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  title="Configurações de sincronização"
                >
                  <Calendar
                    className={`h-4 w-4 ${project.google_calendar_sync_enabled ? "text-emerald-400" : ""}`}
                  />
                  <span className="hidden sm:inline">Calendar</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 space-y-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Google Calendar sync</p>
                  <p className="text-xs text-muted-foreground">
                    Tarefas com data viram eventos no seu Google Calendar.
                  </p>
                </div>
                {!connQuery.data ? (
                  <p className="rounded-md bg-muted/50 px-2 py-1.5 text-xs text-muted-foreground">
                    Conecte sua conta Google em <Link to="/settings" className="underline">Configurações</Link> para ativar.
                  </p>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sincronizar este projeto</span>
                    <Switch
                      checked={project.google_calendar_sync_enabled}
                      onCheckedChange={(v) => syncMutation.mutate(v)}
                      disabled={syncMutation.isPending}
                    />
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}
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
