// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.56.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Flux, an assistant embedded in a project & task management app (Kanban: backlog, todo, doing, review, done).

Principles:
- Be concise and friendly. Respond in the user's language (detect from their message).
- You have tools to read and modify the user's data. ALWAYS prefer using tools over guessing.
- Before creating/updating/deleting/archiving data, first GATHER CONTEXT (e.g. list_projects to find the right project_id by name).
- For destructive or mutating actions (create_task, update_task, delete_task, archive_task), propose them to the user and wait for confirmation. The client surfaces a confirmation card; you do not need to ask "are you sure" in text — just call the tool once, the UI will handle confirmation.
- When listing tasks, summarize briefly: show title, project, status, due date, priority. Use markdown lists.
- Statuses: backlog, todo, doing, review, done. Priorities: low, medium, high, urgent.
- Dates: ISO format YYYY-MM-DD. Infer "today", "tomorrow", day names from the current date given below.
- Never invent IDs. If you don't know an ID, search first with list_tasks or list_projects.`;

// Tools the model can call. Mutating tools require client-side confirmation.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_projects",
      description: "List all projects the user has access to.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description:
        "List tasks. Can filter by project_id, status, priority, due_before/after (YYYY-MM-DD), archived, or free-text search in title.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          status: {
            type: "string",
            enum: ["backlog", "todo", "doing", "review", "done"],
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
          },
          due_before: { type: "string", description: "YYYY-MM-DD" },
          due_after: { type: "string", description: "YYYY-MM-DD" },
          archived: { type: "boolean", description: "Include only archived if true; default false" },
          search: { type: "string", description: "Free-text title search" },
          limit: { type: "number", description: "Max rows, default 20, max 100" },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_task",
      description: "Get a single task with its checklist items.",
      parameters: {
        type: "object",
        properties: { task_id: { type: "string" } },
        required: ["task_id"],
        additionalProperties: false,
      },
    },
  },
  // Mutating — require confirmation on client
  {
    type: "function",
    function: {
      name: "create_task",
      description:
        "Propose creating a new task. REQUIRES USER CONFIRMATION on the client. Call list_projects first if you don't know project_id.",
      parameters: {
        type: "object",
        properties: {
          project_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: {
            type: "string",
            enum: ["backlog", "todo", "doing", "review", "done"],
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
          },
          due_date: { type: "string", description: "YYYY-MM-DD" },
          due_time: { type: "string", description: "HH:MM" },
        },
        required: ["project_id", "title"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description:
        "Propose updating an existing task. REQUIRES USER CONFIRMATION. Include only the fields you want to change.",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          status: {
            type: "string",
            enum: ["backlog", "todo", "doing", "review", "done"],
          },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "urgent"],
          },
          due_date: { type: ["string", "null"], description: "YYYY-MM-DD or null to clear" },
          due_time: { type: ["string", "null"], description: "HH:MM or null to clear" },
        },
        required: ["task_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "archive_task",
      description: "Propose archiving a task. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: { task_id: { type: "string" } },
        required: ["task_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_task",
      description: "Propose deleting a task permanently. REQUIRES USER CONFIRMATION.",
      parameters: {
        type: "object",
        properties: { task_id: { type: "string" } },
        required: ["task_id"],
        additionalProperties: false,
      },
    },
  },
];

const MUTATING_TOOLS = new Set([
  "create_task",
  "update_task",
  "archive_task",
  "delete_task",
]);

// ---------- Tool execution for READ tools (mutating are handled by client after confirmation) ----------
async function runReadTool(
  supabase: any,
  name: string,
  args: any,
): Promise<any> {
  try {
    if (name === "list_projects") {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, color")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return { ok: true, projects: data };
    }
    if (name === "list_tasks") {
      let q = supabase
        .from("tasks")
        .select(
          "id, title, status, priority, due_date, due_time, project_id, archived_at, updated_at",
        );
      if (args.project_id) q = q.eq("project_id", args.project_id);
      if (args.status) q = q.eq("status", args.status);
      if (args.priority) q = q.eq("priority", args.priority);
      if (args.due_before) q = q.lte("due_date", args.due_before);
      if (args.due_after) q = q.gte("due_date", args.due_after);
      if (args.archived === true) q = q.not("archived_at", "is", null);
      else q = q.is("archived_at", null);
      if (args.search) q = q.ilike("title", `%${args.search}%`);
      q = q.limit(Math.min(Math.max(Number(args.limit) || 20, 1), 100));
      const { data, error } = await q;
      if (error) throw error;
      return { ok: true, tasks: data };
    }
    if (name === "get_task") {
      const { data: task, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("id", args.task_id)
        .single();
      if (error) throw error;
      const { data: checklist } = await supabase
        .from("task_checklist_items")
        .select("id, title, is_done, position")
        .eq("task_id", args.task_id)
        .order("position", { ascending: true });
      return { ok: true, task, checklist: checklist ?? [] };
    }
    return { ok: false, error: `Unknown tool ${name}` };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Tool execution failed" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY");
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      throw new Error("Server is missing required environment variables");
    }

    // User-scoped client: RLS enforced on all tool calls
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const history: Array<{
      role: "user" | "assistant" | "tool";
      content: string | null;
      tool_calls?: any[];
      tool_call_id?: string;
      name?: string;
    }> = body.messages ?? [];

    const today = new Date().toISOString().slice(0, 10);
    const systemMsg = {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\nToday's date is ${today}. The user's id is ${user.id}.`,
    };

    // Multi-step tool-calling loop. Read tools are executed inline; mutating tools
    // are emitted to the client and we stop, letting the user confirm.
    let workingMessages: any[] = [systemMsg, ...history];
    const MAX_STEPS = 6;

    for (let step = 0; step < MAX_STEPS; step++) {
      const aiResp = await fetch(
        "https://ai.gateway.lovable.dev/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: workingMessages,
            tools: TOOLS,
            tool_choice: "auto",
          }),
        },
      );

      if (!aiResp.ok) {
        if (aiResp.status === 429) {
          return new Response(
            JSON.stringify({
              error: "Limite de uso da IA atingido. Tente novamente em alguns minutos.",
            }),
            {
              status: 429,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        if (aiResp.status === 402) {
          return new Response(
            JSON.stringify({
              error: "Créditos de IA esgotados. Adicione créditos no workspace.",
            }),
            {
              status: 402,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
        const t = await aiResp.text();
        console.error("AI gateway error:", aiResp.status, t);
        return new Response(
          JSON.stringify({ error: "AI gateway error" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      const aiData = await aiResp.json();
      const choice = aiData.choices?.[0]?.message;
      if (!choice) {
        return new Response(JSON.stringify({ error: "Empty AI response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const toolCalls = choice.tool_calls as Array<any> | undefined;

      // No tool calls — final text answer
      if (!toolCalls || toolCalls.length === 0) {
        return new Response(
          JSON.stringify({
            type: "message",
            content: choice.content ?? "",
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // If ANY tool call is a mutating tool, stop and let client confirm.
      const mutating = toolCalls.find((tc) =>
        MUTATING_TOOLS.has(tc.function?.name)
      );
      if (mutating) {
        // Return the first mutating proposal (one at a time for clarity)
        let args: any = {};
        try {
          args = JSON.parse(mutating.function.arguments || "{}");
        } catch {
          args = {};
        }
        return new Response(
          JSON.stringify({
            type: "action_proposal",
            preface: choice.content ?? "",
            tool_call_id: mutating.id,
            tool_name: mutating.function.name,
            tool_args: args,
            // Include the assistant turn so the client can persist it
            assistant_message: {
              role: "assistant",
              content: choice.content ?? null,
              tool_calls: toolCalls,
            },
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // All read tools — execute inline and loop
      workingMessages.push({
        role: "assistant",
        content: choice.content ?? null,
        tool_calls: toolCalls,
      });
      for (const tc of toolCalls) {
        let args: any = {};
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch {
          args = {};
        }
        const result = await runReadTool(supabase, tc.function.name, args);
        workingMessages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    return new Response(
      JSON.stringify({
        type: "message",
        content:
          "Não consegui concluir em poucas etapas. Pode reformular sua pergunta?",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("chat-ai error:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
