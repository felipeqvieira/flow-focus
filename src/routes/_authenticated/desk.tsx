import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Circle, Flame, Inbox, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { projectsQueryOptions, type Project } from "@/lib/projects";
import {
  allTasksQueryOptions,
  PRIORITY_STYLES,
  STATUS_LABELS,
  updateTask,
  type Task,
  type TaskStatus,
} from "@/lib/tasks";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/desk")({
  loader: ({ context: { queryClient } }) => {
    queryClient.ensureQueryData(projectsQueryOptions());
    queryClient.ensureQueryData(allTasksQueryOptions());
  },
  component: DeskPage,
});

const INVALIDATE_KEYS: (string | string[])[][] = [["tasks", "all"]];

function toLocalDateStr(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDueLabel(iso: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanhã";
  if (diff === -1) return "Ontem";
  if (diff < 0) return `${Math.abs(diff)}d atrasada`;
  if (diff < 7) return `em ${diff}d`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function DeskPage() {
  const { user } = useAuth();
  const projectsQuery = useQuery(projectsQueryOptions());
  const tasksQuery = useQuery(allTasksQueryOptions());
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const projects = projectsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const projectsById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])) as Record<string, Project>,
    [projects],
  );

  const today = toLocalDateStr(new Date());
  const in7 = new Date();
  in7.setDate(in7.getDate() + 7);
  const in7Str = toLocalDateStr(in7);

  const { overdueTasks, todayTasks, upcomingTasks, doneToday, activeTasks } = useMemo(() => {
    const active = tasks.filter((t) => !t.archived_at);
    const overdue: Task[] = [];
    const todayList: Task[] = [];
    const upcoming: Task[] = [];
    let completedToday = 0;

    for (const t of active) {
      if (t.status !== "done" && t.due_date) {
        if (t.due_date < today) overdue.push(t);
        else if (t.due_date === today) todayList.push(t);
        else if (t.due_date <= in7Str) upcoming.push(t);
      }
    }
    // "Done today" = tasks in done status updated today (rough proxy)
    for (const t of tasks) {
      if (t.status === "done" && t.updated_at.slice(0, 10) === today) completedToday += 1;
    }

    const byDue = (a: Task, b: Task) =>
      (a.due_date ?? "").localeCompare(b.due_date ?? "") ||
      (a.due_time ?? "").localeCompare(b.due_time ?? "");
    overdue.sort(byDue);
    todayList.sort(byDue);
    upcoming.sort(byDue);

    return {
      overdueTasks: overdue,
      todayTasks: todayList,
      upcomingTasks: upcoming,
      doneToday: completedToday,
      activeTasks: active,
    };
  }, [tasks, today, in7Str]);

  // Per-project progress (active only)
  const projectProgress = useMemo(() => {
    return projects
      .map((p) => {
        const pTasks = activeTasks.filter((t) => t.project_id === p.id);
        const total = pTasks.length;
        const done = pTasks.filter((t) => t.status === "done").length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        return { project: p, total, done, pct };
      })
      .sort((a, b) => b.total - a.total);
  }, [projects, activeTasks]);

  const totalActive = activeTasks.filter((t) => t.status !== "done").length;

  const handleOpenTask = (task: Task) => {
    setOpenTask(task);
    setDialogOpen(true);
  };

  const liveTask = openTask ? tasks.find((t) => t.id === openTask.id) ?? null : null;

  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "por aí";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          {greeting}, {displayName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date().toLocaleDateString("pt-BR", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
      </header>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:mb-8 md:grid-cols-4">
        <StatCard
          icon={<Flame className="h-4 w-4" />}
          label="Atrasadas"
          value={overdueTasks.length}
          tone={overdueTasks.length > 0 ? "danger" : "neutral"}
        />
        <StatCard
          icon={<CalendarClock className="h-4 w-4" />}
          label="Para hoje"
          value={todayTasks.length}
          tone="primary"
        />
        <StatCard
          icon={<Inbox className="h-4 w-4" />}
          label="Abertas"
          value={totalActive}
          tone="neutral"
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Concluídas hoje"
          value={doneToday}
          tone="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TaskSection
            title="Atrasadas"
            tone="danger"
            emptyLabel="Nenhuma tarefa atrasada. 🎉"
            tasks={overdueTasks}
            projectsById={projectsById}
            onOpen={handleOpenTask}
          />
          <TaskSection
            title="Hoje"
            tone="primary"
            emptyLabel="Nada agendado para hoje."
            tasks={todayTasks}
            projectsById={projectsById}
            onOpen={handleOpenTask}
          />
          <TaskSection
            title="Próximos 7 dias"
            tone="neutral"
            emptyLabel="Sem tarefas na próxima semana."
            tasks={upcomingTasks}
            projectsById={projectsById}
            onOpen={handleOpenTask}
          />
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Progresso dos projetos</h2>
            </div>
            {projectProgress.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum projeto ainda.</p>
            ) : (
              <ul className="space-y-3">
                {projectProgress.map(({ project, total, done, pct }) => (
                  <li key={project.id}>
                    <Link
                      to="/projects/$id"
                      params={{ id: project.id }}
                      className="group block"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: project.color }}
                          />
                          <span className="truncate text-sm group-hover:text-primary">
                            {project.name}
                          </span>
                        </div>
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {done}/{total}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: project.color,
                          }}
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>

      <TaskDialog
        task={liveTask}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invalidateKeys={INVALIDATE_KEYS}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "neutral" | "primary" | "danger" | "success";
}) {
  const toneMap = {
    neutral: "text-muted-foreground",
    primary: "text-primary",
    danger: "text-red-400",
    success: "text-emerald-400",
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className={cn("flex items-center gap-2 text-xs", toneMap[tone])}>
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function TaskSection({
  title,
  tone,
  tasks,
  emptyLabel,
  projectsById,
  onOpen,
}: {
  title: string;
  tone: "neutral" | "primary" | "danger";
  tasks: Task[];
  emptyLabel: string;
  projectsById: Record<string, Project>;
  onOpen: (t: Task) => void;
}) {
  const titleTone = {
    neutral: "text-foreground",
    primary: "text-primary",
    danger: "text-red-400",
  }[tone];

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className={cn("text-sm font-semibold", titleTone)}>
          {title}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {tasks.length}
          </span>
        </h2>
      </div>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          {emptyLabel}
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <DeskTaskRow
              key={t.id}
              task={t}
              project={projectsById[t.project_id]}
              onOpen={onOpen}
              overdue={tone === "danger"}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DeskTaskRow({
  task,
  project,
  onOpen,
  overdue,
}: {
  task: Task;
  project?: Project;
  onOpen: (t: Task) => void;
  overdue?: boolean;
}) {
  const qc = useQueryClient();
  const isDone = task.status === "done";

  const toggleMutation = useMutation({
    mutationFn: (next: TaskStatus) => updateTask({ id: task.id, status: next }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["tasks", "all"] });
      const prev = qc.getQueryData<Task[]>(["tasks", "all"]);
      qc.setQueryData<Task[]>(["tasks", "all"], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, status: next } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks", "all"], ctx.prev);
      toast.error("Erro ao atualizar");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["tasks", "all"] });
    },
  });

  const priorityBadge = PRIORITY_STYLES[task.priority];

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-border/80 hover:bg-accent/40",
          overdue && "border-red-500/30",
        )}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleMutation.mutate(isDone ? "todo" : "done");
          }}
          className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={isDone ? "Desmarcar" : "Concluir"}
        >
          {isDone ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          ) : (
            <Circle className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={() => onOpen(task)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={cn(
              "truncate text-sm",
              isDone && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </span>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {task.priority !== "medium" && task.priority !== "low" && (
              <span
                className={cn(
                  "rounded border px-1.5 py-0.5 text-[10px] font-medium",
                  priorityBadge.badge,
                )}
              >
                {priorityBadge.label}
              </span>
            )}

            {task.due_date && (
              <span
                className={cn(
                  "text-[11px] tabular-nums",
                  overdue ? "text-red-400" : "text-muted-foreground",
                )}
              >
                {formatDueLabel(task.due_date)}
                {task.due_time && ` · ${task.due_time.slice(0, 5)}`}
              </span>
            )}

            {project && (
              <span className="hidden items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                {project.name}
              </span>
            )}

            <span className="hidden text-[10px] uppercase tracking-wider text-muted-foreground md:inline">
              {STATUS_LABELS[task.status]}
            </span>
          </div>
        </button>
      </div>
    </li>
  );
}
