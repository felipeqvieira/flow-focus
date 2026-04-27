import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Archive, ArchiveRestore } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Task } from "@/lib/tasks";
import { archiveTask, unarchiveTask } from "@/lib/tasks";
import type { Project } from "@/lib/projects";

type TaskCardProps = {
  task: Task;
  project?: Project;
  showProject?: boolean;
  invalidateKeys?: (string | string[])[][];
};

export function TaskCard({ task, project, showProject = false, invalidateKeys }: TaskCardProps) {
  const qc = useQueryClient();
  const isArchived = !!task.archived_at;
  const canArchive = task.status === "done";

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isArchived,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: 50 }
    : undefined;

  const formattedDate = task.due_date
    ? new Date(task.due_date + "T00:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })
    : null;

  const archiveMutation = useMutation({
    mutationFn: () => (isArchived ? unarchiveTask(task.id) : archiveTask(task.id)),
    onSuccess: () => {
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
      toast.success(isArchived ? "Tarefa restaurada" : "Tarefa arquivada");
    },
    onError: () => toast.error("Não foi possível atualizar a tarefa"),
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isArchived ? {} : listeners)}
      {...attributes}
      className={`group relative rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:border-ring/50 hover:shadow-md ${
        isArchived ? "opacity-60" : "cursor-grab active:cursor-grabbing"
      } ${isDragging ? "opacity-50" : ""}`}
    >
      {showProject && project && (
        <div className="mb-2 flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: project.color }}
          />
          <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            {project.name}
          </span>
        </div>
      )}
      <div className="text-sm font-medium leading-snug text-foreground">{task.title}</div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {formattedDate ? (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {formattedDate}
          </div>
        ) : (
          <span />
        )}

        {canArchive && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              archiveMutation.mutate();
            }}
            disabled={archiveMutation.isPending}
            className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-background hover:text-foreground group-hover:opacity-100 disabled:opacity-50"
            title={isArchived ? "Restaurar" : "Arquivar"}
          >
            {isArchived ? (
              <ArchiveRestore className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
