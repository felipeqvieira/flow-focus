import { supabase } from "@/integrations/supabase/client";
import {
  archiveTask,
  createTask,
  deleteTask,
  updateTask,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks";

export type ChatRole = "user" | "assistant" | "tool" | "system";

export type ChatMessage = {
  id: string;
  user_id: string;
  role: ChatRole;
  content: string | null;
  tool_calls: unknown | null;
  tool_call_id: string | null;
  tool_name: string | null;
  tool_args: Record<string, unknown> | null;
  tool_result: unknown | null;
  status: "complete" | "pending_confirmation" | "confirmed" | "cancelled";
  created_at: string;
};

export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function insertUserMessage(
  userId: string,
  content: string,
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ user_id: userId, role: "user", content })
    .select()
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

export async function insertAssistantMessage(
  userId: string,
  input: {
    content: string | null;
    tool_calls?: unknown | null;
    tool_call_id?: string | null;
    tool_name?: string | null;
    tool_args?: Record<string, unknown> | null;
    status?: ChatMessage["status"];
  },
): Promise<ChatMessage> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      user_id: userId,
      role: "assistant",
      content: input.content,
      tool_calls: (input.tool_calls as never) ?? null,
      tool_call_id: input.tool_call_id ?? null,
      tool_name: input.tool_name ?? null,
      tool_args: (input.tool_args as never) ?? null,
      status: input.status ?? "complete",
    })
    .select()
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

export async function updateMessageStatus(
  id: string,
  status: ChatMessage["status"],
  tool_result?: unknown,
): Promise<void> {
  const patch: { status: ChatMessage["status"]; tool_result?: never } = {
    status,
  };
  if (tool_result !== undefined) {
    (patch as { tool_result: unknown }).tool_result = tool_result;
  }
  const { error } = await supabase
    .from("chat_messages")
    .update(patch as never)
    .eq("id", id);
  if (error) throw error;
}

export async function clearChatHistory(userId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

// ---------- Call the edge function ----------
type EdgeResponse =
  | { type: "message"; content: string }
  | {
      type: "action_proposal";
      preface: string;
      tool_call_id: string;
      tool_name: string;
      tool_args: Record<string, unknown>;
    }
  | { error: string };

export async function sendChat(
  messagesForApi: Array<Record<string, unknown>>,
): Promise<EdgeResponse> {
  const { data, error } = await supabase.functions.invoke("chat-ai", {
    body: { messages: messagesForApi },
  });
  if (error) {
    // supabase-js puts non-2xx as errors with .context
    const ctx = (error as { context?: Response }).context;
    if (ctx) {
      try {
        const j = await ctx.json();
        return { error: j.error ?? "Erro ao chamar IA" };
      } catch {
        /* ignore */
      }
    }
    return { error: error.message ?? "Erro ao chamar IA" };
  }
  return data as EdgeResponse;
}

// Build the payload sent to the edge function from DB history.
// Skip pending/cancelled proposals so the model doesn't loop on them.
export function buildApiMessages(
  history: ChatMessage[],
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const m of history) {
    if (m.role === "user") {
      out.push({ role: "user", content: m.content ?? "" });
    } else if (m.role === "assistant") {
      if (m.status === "pending_confirmation" || m.status === "cancelled") {
        // Skip — the tool call was never executed
        continue;
      }
      if (m.status === "confirmed" && m.tool_call_id && m.tool_name) {
        // Replay as an assistant tool-call turn + its tool result
        out.push({
          role: "assistant",
          content: m.content ?? null,
          tool_calls: [
            {
              id: m.tool_call_id,
              type: "function",
              function: {
                name: m.tool_name,
                arguments: JSON.stringify(m.tool_args ?? {}),
              },
            },
          ],
        });
        out.push({
          role: "tool",
          tool_call_id: m.tool_call_id,
          content: JSON.stringify(m.tool_result ?? { ok: true }),
        });
      } else if (m.content) {
        out.push({ role: "assistant", content: m.content });
      }
    }
  }
  return out;
}

// ---------- Execute a confirmed mutating tool client-side (uses RLS) ----------
export async function executeToolAction(
  name: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    if (name === "create_task") {
      const task = await createTask({
        projectId: String(args.project_id),
        title: String(args.title),
        status: (args.status as TaskStatus) ?? "todo",
        createdBy: userId,
        position: Date.now(),
      });
      const patch: Record<string, unknown> = {};
      if (args.description) patch.description = args.description;
      if (args.priority) patch.priority = args.priority as TaskPriority;
      if (args.due_date) patch.due_date = args.due_date;
      if (args.due_time) patch.due_time = args.due_time;
      if (Object.keys(patch).length > 0) {
        await updateTask({ id: task.id, ...patch });
      }
      return { ok: true, result: { task_id: task.id, title: task.title } };
    }
    if (name === "update_task") {
      await updateTask({
        id: String(args.task_id),
        ...(args.title !== undefined && { title: args.title as string }),
        ...(args.description !== undefined && {
          description: args.description as string | null,
        }),
        ...(args.status !== undefined && {
          status: args.status as TaskStatus,
        }),
        ...(args.priority !== undefined && {
          priority: args.priority as TaskPriority,
        }),
        ...(args.due_date !== undefined && {
          due_date: args.due_date as string | null,
        }),
        ...(args.due_time !== undefined && {
          due_time: args.due_time as string | null,
        }),
      });
      return { ok: true };
    }
    if (name === "archive_task") {
      await archiveTask(String(args.task_id));
      return { ok: true };
    }
    if (name === "delete_task") {
      await deleteTask(String(args.task_id));
      return { ok: true };
    }
    return { ok: false, error: `Ação desconhecida: ${name}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro" };
  }
}

export const ACTION_LABELS: Record<string, string> = {
  create_task: "Criar tarefa",
  update_task: "Atualizar tarefa",
  archive_task: "Arquivar tarefa",
  delete_task: "Excluir tarefa",
};
