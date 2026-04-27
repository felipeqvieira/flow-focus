import { useMemo, useState } from "react";
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KanbanColumn } from "./KanbanColumn";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import {
  STATUS_LABELS,
  TASK_STATUSES,
  checklistCountsQueryOptions,
  createTask,
  updateTaskPosition,
  type Task,
  type TaskStatus,
} from "@/lib/tasks";
import type { Project } from "@/lib/projects";

type KanbanBoardProps = {
  tasks: Task[];
  projects: Project[];
  defaultProjectId?: string;
  showProjectTag?: boolean;
  currentUserId: string;
  invalidateKeys: (string | string[])[][];
};

export function KanbanBoard({
  tasks,
  projects,
  defaultProjectId,
  showProjectTag,
  currentUserId,
  invalidateKeys,
}: KanbanBoardProps) {
  const qc = useQueryClient();
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));

  // Separate active vs archived
  const { activeTasks, archivedByStatus } = useMemo(() => {
    const active: Task[] = [];
    const archived: Record<TaskStatus, Task[]> = {
      backlog: [],
      todo: [],
      doing: [],
      review: [],
      done: [],
    };
    for (const t of tasks) {
      if (t.archived_at) archived[t.status].push(t);
      else active.push(t);
    }
    return { activeTasks: active, archivedByStatus: archived };
  }, [tasks]);

  // Load checklist counts for visible tasks
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const countsOptions = checklistCountsQueryOptions(taskIds);
  useQuery(countsOptions);
  const countsKey = countsOptions.queryKey;

  // Keep dialog task in sync if data changes
  const liveTask = openTask ? tasks.find((t) => t.id === openTask.id) ?? null : null;

  const moveMutation = useMutation({
    mutationFn: updateTaskPosition,
    onMutate: async (vars) => {
      await Promise.all(invalidateKeys.map((k) => qc.cancelQueries({ queryKey: k })));
      const snapshots = invalidateKeys.map((k) => [k, qc.getQueryData<Task[]>(k)] as const);
      for (const [key] of snapshots) {
        qc.setQueryData<Task[]>(key, (old) =>
          old?.map((t) =>
            t.id === vars.id ? { ...t, status: vars.status, position: vars.position } : t,
          ),
        );
      }
      return { snapshots };
    },
    onError: (_err, _vars, ctx) => {
      ctx?.snapshots.forEach(([key, snap]) => qc.setQueryData(key, snap));
      toast.error("Erro ao mover tarefa");
    },
    onSettled: () => {
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
    onError: () => toast.error("Erro ao criar tarefa"),
  });

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over) return;
    const task = active.data.current?.task as Task | undefined;
    const newStatus = over.data.current?.status as TaskStatus | undefined;
    if (!task || !newStatus) return;
    if (task.status === newStatus) return;

    const colTasks = activeTasks.filter((t) => t.status === newStatus);
    const lastPos = colTasks.length > 0 ? Math.max(...colTasks.map((t) => t.position)) : 0;
    const newPosition = lastPos + 1000;

    moveMutation.mutate({ id: task.id, status: newStatus, position: newPosition });
  };

  const handleAddTask = (title: string, status: TaskStatus) => {
    if (!defaultProjectId) {
      toast.error("Selecione um projeto para adicionar tarefas");
      return;
    }
    const colTasks = activeTasks.filter((t) => t.status === status);
    const lastPos = colTasks.length > 0 ? Math.max(...colTasks.map((t) => t.position)) : 0;
    createMutation.mutate({
      title,
      projectId: defaultProjectId,
      status,
      createdBy: currentUserId,
      position: lastPos + 1000,
    });
  };

  const handleOpenTask = (task: Task) => {
    setOpenTask(task);
    setDialogOpen(true);
  };

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex h-full snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 md:snap-none md:px-6">
          {TASK_STATUSES.map((status) => {
            const colTasks = activeTasks
              .filter((t) => t.status === status)
              .sort((a, b) => a.position - b.position);
            return (
              <div key={status} className="snap-start">
                <KanbanColumn
                  status={status}
                  label={STATUS_LABELS[status]}
                  tasks={colTasks}
                  archivedTasks={archivedByStatus[status]}
                  projectsById={projectsById}
                  showProjectTag={showProjectTag}
                  onAddTask={defaultProjectId ? handleAddTask : undefined}
                  onOpenTask={handleOpenTask}
                  invalidateKeys={invalidateKeys}
                  checklistCountsKey={countsKey}
                />
              </div>
            );
          })}
        </div>
      </DndContext>

      <TaskDialog
        task={liveTask}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invalidateKeys={invalidateKeys}
      />
    </>
  );
}
