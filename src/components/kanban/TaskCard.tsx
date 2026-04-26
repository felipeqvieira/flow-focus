import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar } from "lucide-react";
import type { Task } from "@/lib/tasks";
import type { Project } from "@/lib/projects";

type TaskCardProps = {
  task: Task;
  project?: Project;
  showProject?: boolean;
};

export function TaskCard({ task, project, showProject = false }: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`group cursor-grab rounded-lg border border-border bg-card p-3 text-left shadow-sm transition-shadow hover:border-ring/50 hover:shadow-md active:cursor-grabbing ${
        isDragging ? "opacity-50" : ""
      }`}
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
      {formattedDate && (
        <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formattedDate}
        </div>
      )}
    </div>
  );
}
