import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarIcon,
  Trash2,
  Plus,
  X,
  Archive,
  ArchiveRestore,
  Bell,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  STATUS_LABELS,
  TASK_STATUSES,
  archiveTask,
  createChecklistItem,
  deleteChecklistItem,
  deleteTask,
  taskChecklistQueryOptions,
  unarchiveTask,
  updateChecklistItem,
  updateTask,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";
import { REMINDER_OPTIONS } from "@/lib/notifications";
import { triggerGoogleSync } from "@/lib/googleSync";

type Props = {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invalidateKeys: (string | string[])[][];
};

export function TaskDialog({ task, open, onOpenChange, invalidateKeys }: Props) {
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [dueTime, setDueTime] = useState<string>("");
  const [reminders, setReminders] = useState<number[]>([]);
  const [newItem, setNewItem] = useState("");

  // Sync local state when task changes / dialog opens
  useEffect(() => {
    if (task && open) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setEditingDescription(false);
      setStatus(task.status);
      setPriority(task.priority);
      setDueDate(task.due_date ? new Date(task.due_date + "T00:00:00") : undefined);
      setDueTime(task.due_time ? task.due_time.slice(0, 5) : "");
      setReminders(task.reminder_offsets ?? []);
      setNewItem("");
    }
  }, [task, open]);

  const checklistQuery = useQuery({
    ...taskChecklistQueryOptions(task?.id ?? ""),
    enabled: !!task && open,
  });
  const items = checklistQuery.data ?? [];

  const invalidateAll = () => {
    invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
  };
  const invalidateChecklist = () => {
    if (task) qc.invalidateQueries({ queryKey: ["checklist", task.id] });
    qc.invalidateQueries({ queryKey: ["checklist", "counts"] });
  };

  const updateMutation = useMutation({
    mutationFn: updateTask,
    onSuccess: (_data, vars) => {
      invalidateAll();
      triggerGoogleSync(vars.id, "upsert");
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: (_d, id) => {
      triggerGoogleSync(id, "delete");
      invalidateAll();
      toast.success("Tarefa excluída");
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  const archiveMutation = useMutation({
    mutationFn: () =>
      task && task.archived_at ? unarchiveTask(task.id) : archiveTask(task!.id),
    onSuccess: () => {
      if (task) triggerGoogleSync(task.id, "upsert");
      invalidateAll();
      toast.success(task?.archived_at ? "Restaurada" : "Arquivada");
    },
  });

  const addItemMutation = useMutation({
    mutationFn: (title: string) => {
      const lastPos = items.length > 0 ? Math.max(...items.map((i) => i.position)) : 0;
      return createChecklistItem({
        taskId: task!.id,
        title,
        position: lastPos + 1000,
      });
    },
    onSuccess: () => {
      setNewItem("");
      invalidateChecklist();
    },
    onError: () => toast.error("Erro ao adicionar item"),
  });

  const toggleItemMutation = useMutation({
    mutationFn: (input: { id: string; is_done: boolean }) => updateChecklistItem(input),
    onMutate: async (vars) => {
      if (!task) return;
      const key = ["checklist", task.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: typeof items | undefined) =>
        old?.map((it) => (it.id === vars.id ? { ...it, is_done: vars.is_done } : it)),
      );
      return { prev, key };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(ctx.key, ctx.prev),
    onSettled: invalidateChecklist,
  });

  const deleteItemMutation = useMutation({
    mutationFn: deleteChecklistItem,
    onSuccess: invalidateChecklist,
  });

  if (!task) return null;

  const handleSaveTitle = () => {
    const t = title.trim();
    if (t && t !== task.title) updateMutation.mutate({ id: task.id, title: t });
  };

  const handleSaveDescription = () => {
    const d = description.trim();
    const current = task.description ?? "";
    if (d !== current) updateMutation.mutate({ id: task.id, description: d || null });
    setEditingDescription(false);
  };

  const handleStatusChange = (s: TaskStatus) => {
    setStatus(s);
    updateMutation.mutate({ id: task.id, status: s });
  };

  const handlePriorityChange = (p: TaskPriority) => {
    setPriority(p);
    updateMutation.mutate({ id: task.id, priority: p });
  };

  const handleDateChange = (d: Date | undefined) => {
    setDueDate(d);
    updateMutation.mutate({
      id: task.id,
      due_date: d ? format(d, "yyyy-MM-dd") : null,
    });
  };

  const handleTimeChange = (val: string) => {
    setDueTime(val);
    updateMutation.mutate({
      id: task.id,
      due_time: val ? val + ":00" : null,
    });
  };

  const handleAddItem = () => {
    const t = newItem.trim();
    if (t) addItemMutation.mutate(t);
  };

  const doneCount = items.filter((i) => i.is_done).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="space-y-2">
          <DialogTitle className="sr-only">Detalhes da tarefa</DialogTitle>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            className="border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
            placeholder="Título da tarefa"
          />
        </DialogHeader>

        {/* Meta row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </label>
            <Select value={status} onValueChange={(v) => handleStatusChange(v as TaskStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Prioridade
            </label>
            <Select
              value={priority}
              onValueChange={(v) => handlePriorityChange(v as TaskPriority)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", PRIORITY_STYLES[p].dot)} />
                      {PRIORITY_LABELS[p]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Vencimento
            </label>
            <div className="flex gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start gap-2 px-2 text-left font-normal",
                      !dueDate && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span className="truncate">
                      {dueDate ? format(dueDate, "dd MMM", { locale: ptBR }) : "Data"}
                    </span>
                    {dueDate && (
                      <X
                        className="ml-auto h-3.5 w-3.5 shrink-0 opacity-60 hover:opacity-100"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDateChange(undefined);
                        }}
                      />
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={handleDateChange}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                onBlur={(e) => handleTimeChange(e.target.value)}
                className="w-[88px] px-2"
                disabled={!dueDate}
              />
            </div>
          </div>
        </div>

        {/* Reminders */}
        {dueDate && (
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Bell className="h-3 w-3" /> Lembretes
            </label>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_OPTIONS.map((opt) => {
                const active = reminders.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? reminders.filter((r) => r !== opt.value)
                        : [...reminders, opt.value].sort((a, b) => a - b);
                      setReminders(next);
                      updateMutation.mutate({ id: task.id, reminder_offsets: next });
                    }}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Descrição
            </label>
            {!editingDescription && description && (
              <button
                onClick={() => setEditingDescription(true)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Editar
              </button>
            )}
          </div>
          {editingDescription || !description ? (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleSaveDescription}
              onFocus={() => setEditingDescription(true)}
              placeholder="Adicione uma descrição (markdown suportado)..."
              className="min-h-[100px] resize-y"
            />
          ) : (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setEditingDescription(true)}
              className="prose prose-sm prose-invert max-w-none cursor-text rounded-md border border-transparent px-2 py-1.5 text-sm hover:border-border [&_a]:text-primary [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_p]:my-1 [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
            >
              <ReactMarkdown>{description}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Checklist
            </label>
            {items.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {doneCount}/{items.length}
              </span>
            )}
          </div>

          {items.length > 0 && (
            <div className="space-y-1">
              {items.map((it) => (
                <div
                  key={it.id}
                  className="group flex items-start gap-2 rounded px-1 py-1 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={it.is_done}
                    onCheckedChange={(v) =>
                      toggleItemMutation.mutate({ id: it.id, is_done: !!v })
                    }
                    className="mt-0.5"
                  />
                  <span
                    className={cn(
                      "flex-1 text-sm",
                      it.is_done && "text-muted-foreground line-through",
                    )}
                  >
                    {it.title}
                  </span>
                  <button
                    onClick={() => deleteItemMutation.mutate(it.id)}
                    className="opacity-0 transition-opacity group-hover:opacity-60 hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-1.5">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddItem();
                }
              }}
              placeholder="Adicionar item..."
              className="h-8"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleAddItem}
              disabled={!newItem.trim() || addItemMutation.isPending}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => archiveMutation.mutate()}
            className="gap-1.5 text-muted-foreground"
          >
            {task.archived_at ? (
              <>
                <ArchiveRestore className="h-3.5 w-3.5" /> Restaurar
              </>
            ) : (
              <>
                <Archive className="h-3.5 w-3.5" /> Arquivar
              </>
            )}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. A tarefa e seu checklist serão removidos
                  permanentemente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate(task.id)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </DialogContent>
    </Dialog>
  );
}
