import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { TaskCard } from "./TaskCard";
import type { Task, TaskStatus } from "@/lib/tasks";
import type { Project } from "@/lib/projects";

type KanbanColumnProps = {
  status: TaskStatus;
  label: string;
  tasks: Task[];
  projectsById?: Record<string, Project>;
  showProjectTag?: boolean;
  onAddTask?: (title: string, status: TaskStatus) => void;
};

export function KanbanColumn({
  status,
  label,
  tasks,
  projectsById,
  showProjectTag,
  onAddTask,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } });
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = () => {
    const t = draft.trim();
    if (t && onAddTask) onAddTask(t, status);
    setDraft("");
    setAdding(false);
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg bg-muted/40 p-2 transition-colors md:w-72 ${
        isOver ? "bg-muted/80 ring-1 ring-ring" : ""
      }`}
    >
      <div className="flex items-center justify-between px-2 pb-2 pt-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
            {label}
          </span>
          <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        {onAddTask && (
          <button
            onClick={() => setAdding(true)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            title="Adicionar tarefa"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-1 pb-1">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            project={projectsById?.[task.project_id]}
            showProject={showProjectTag}
          />
        ))}

        {adding && (
          <div className="rounded-lg border border-border bg-card p-2">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
                if (e.key === "Escape") {
                  setAdding(false);
                  setDraft("");
                }
              }}
              onBlur={submit}
              placeholder="Título da tarefa..."
              className="w-full resize-none border-0 bg-transparent p-0 text-sm outline-none placeholder:text-muted-foreground"
              rows={2}
            />
          </div>
        )}

        {!adding && onAddTask && tasks.length === 0 && (
          <button
            onClick={() => setAdding(true)}
            className="rounded-md border border-dashed border-border px-3 py-6 text-xs text-muted-foreground transition-colors hover:border-ring/50 hover:text-foreground"
          >
            + Adicionar tarefa
          </button>
        )}
      </div>
    </div>
  );
}
