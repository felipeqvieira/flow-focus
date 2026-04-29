import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Trash2,
  Pencil,
  CheckSquare,
  ListChecks,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  PRIORITY_STYLES,
  STATUS_LABELS,
  TASK_STATUSES,
  archiveTask,
  checklistCountsQueryOptions,
  deleteTask,
  unarchiveTask,
  updateTask,
  type Task,
  type TaskStatus,
} from "@/lib/tasks";
import type { Project } from "@/lib/projects";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

type TaskCardProps = {
  task: Task;
  project?: Project;
  showProject?: boolean;
  invalidateKeys?: (string | string[])[][];
  onOpen?: (task: Task) => void;
  checklistCountsKey?: (string | string[])[];
};

export function TaskCard({
  task,
  project,
  showProject = false,
  invalidateKeys,
  onOpen,
  checklistCountsKey,
}: TaskCardProps) {
  const qc = useQueryClient();
  const isArchived = !!task.archived_at;
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(task.title);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: isArchived || editingTitle,
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

  const invalidateAll = () => {
    invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  };

  const archiveMutation = useMutation({
    mutationFn: () => (isArchived ? unarchiveTask(task.id) : archiveTask(task.id)),
    onSuccess: () => {
      invalidateAll();
      toast.success(isArchived ? "Tarefa restaurada" : "Tarefa arquivada");
    },
    onError: () => toast.error("Não foi possível atualizar"),
  });

  const updateMutation = useMutation({
    mutationFn: updateTask,
    onSuccess: invalidateAll,
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      invalidateAll();
      toast.success("Tarefa excluída");
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  // Read checklist counts from a shared cache key (computed by the parent board)
  const countsQuery = useQuery({
    queryKey: checklistCountsKey ?? ["checklist", "counts", "__none"],
    enabled: false, // parent provides; we just read cache
  });
  const counts = (countsQuery.data ?? {}) as Record<string, { total: number; done: number }>;
  const c = counts[task.id];

  const isDone = task.status === "done";
  const priorityStyle = PRIORITY_STYLES[task.priority];

  const handleToggleDone = (checked: boolean) => {
    updateMutation.mutate({
      id: task.id,
      status: checked ? "done" : "todo",
    });
  };

  const handleSaveTitle = () => {
    const t = titleDraft.trim();
    setEditingTitle(false);
    if (t && t !== task.title) {
      updateMutation.mutate({ id: task.id, title: t });
    } else {
      setTitleDraft(task.title);
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (editingTitle) return;
    // Avoid opening when clicking interactive children
    const target = e.target as HTMLElement;
    if (target.closest("[data-no-open]")) return;
    onOpen?.(task);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(isArchived || editingTitle ? {} : listeners)}
      {...attributes}
      onClick={handleCardClick}
      className={cn(
        "group relative rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:border-ring/50 hover:shadow-md",
        isArchived ? "opacity-60" : "cursor-pointer",
        isDragging && "opacity-50",
      )}
    >
      {/* Top row: project tag + menu */}
      <div
        className={cn(
          "flex items-start justify-between gap-2",
          showProject && project ? "mb-1.5" : "",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {showProject && project && (
            <>
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {project.name}
              </span>
            </>
          )}
        </div>

        <div
          data-no-open
          className={cn(
            "flex shrink-0 items-center gap-0.5",
            !(showProject && project) && "absolute right-2 top-2",
          )}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="rounded p-1 text-muted-foreground opacity-0 transition-all hover:bg-background hover:text-foreground group-hover:opacity-100"
                title="Mais ações"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onSelect={() => {
                  setEditingTitle(true);
                  setTitleDraft(task.title);
                }}
              >
                <Pencil className="mr-2 h-3.5 w-3.5" /> Renomear
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onOpen?.(task)}>
                <CheckSquare className="mr-2 h-3.5 w-3.5" /> Abrir detalhes
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Mover para</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {TASK_STATUSES.map((s) => (
                    <DropdownMenuItem
                      key={s}
                      disabled={s === task.status}
                      onSelect={() =>
                        updateMutation.mutate({ id: task.id, status: s as TaskStatus })
                      }
                    >
                      {STATUS_LABELS[s]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => archiveMutation.mutate()}>
                {isArchived ? (
                  <>
                    <ArchiveRestore className="mr-2 h-3.5 w-3.5" /> Restaurar
                  </>
                ) : (
                  <>
                    <Archive className="mr-2 h-3.5 w-3.5" /> Arquivar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  if (confirm("Excluir esta tarefa?")) deleteMutation.mutate(task.id);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Title row with done checkbox */}
      <div className="flex items-start gap-2">
        <div data-no-open className="pt-0.5">
          <Checkbox
            checked={isDone}
            onCheckedChange={(v) => handleToggleDone(!!v)}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Marcar como concluído"
          />
        </div>
        {editingTitle ? (
          <input
            data-no-open
            autoFocus
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSaveTitle();
              }
              if (e.key === "Escape") {
                setEditingTitle(false);
                setTitleDraft(task.title);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 border-0 bg-transparent p-0 text-sm font-medium leading-snug text-foreground outline-none ring-0"
          />
        ) : (
          <div
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingTitle(true);
              setTitleDraft(task.title);
            }}
            className={cn(
              "flex-1 text-sm font-medium leading-snug text-foreground",
              isDone && "text-muted-foreground line-through",
            )}
            title="Duplo-clique para editar"
          >
            {task.title}
          </div>
        )}
      </div>

      {/* Footer: priority + date + checklist count */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 pl-6 text-[11px] text-muted-foreground">
        <span
          data-no-open
          className={cn(
            "rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
            priorityStyle.badge,
          )}
          title={`Prioridade: ${priorityStyle.label}`}
        >
          {priorityStyle.label}
        </span>
        {formattedDate && (
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formattedDate}
            {task.due_time && <span>· {task.due_time.slice(0, 5)}</span>}
          </div>
        )}
        {c && c.total > 0 && (
          <div
            className={cn(
              "flex items-center gap-1",
              c.done === c.total && "text-emerald-400",
            )}
          >
            <ListChecks className="h-3 w-3" />
            {c.done}/{c.total}
          </div>
        )}
      </div>
    </div>
  );
}
