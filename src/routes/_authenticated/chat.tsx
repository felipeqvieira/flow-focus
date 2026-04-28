import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Send, Sparkles, Trash2, Check, X, Loader2, Wrench } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  ACTION_LABELS,
  buildApiMessages,
  clearChatHistory,
  executeToolAction,
  fetchChatHistory,
  insertAssistantMessage,
  insertUserMessage,
  sendChat,
  updateMessageStatus,
  type ChatMessage,
} from "@/lib/chat";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function ChatPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["chat", "history"],
    queryFn: fetchChatHistory,
    enabled: !!user,
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history.length, busy]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["chat", "history"] });
  const refreshTasks = () => {
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  const clearMut = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await clearChatHistory(user.id);
    },
    onSuccess: () => {
      refresh();
      toast.success("Conversa limpa");
    },
  });

  async function runAssistantTurn(baseHistory: ChatMessage[]) {
    if (!user) return;
    // Loop to allow multiple read-tool turns from the model
    let loopGuard = 0;
    let working = baseHistory;
    while (loopGuard++ < 6) {
      const apiMessages = buildApiMessages(working);
      const res = await sendChat(apiMessages);
      if ("error" in res) {
        toast.error(res.error);
        await insertAssistantMessage(user.id, {
          content: `⚠️ ${res.error}`,
        });
        await refresh();
        return;
      }
      if (res.type === "message") {
        await insertAssistantMessage(user.id, { content: res.content });
        await refresh();
        return;
      }
      if (res.type === "action_proposal") {
        // preface message (optional)
        if (res.preface?.trim()) {
          await insertAssistantMessage(user.id, { content: res.preface });
        }
        await insertAssistantMessage(user.id, {
          content: null,
          tool_call_id: res.tool_call_id,
          tool_name: res.tool_name,
          tool_args: res.tool_args,
          status: "pending_confirmation",
        });
        await refresh();
        return; // wait for user confirmation
      }
      break;
    }
  }

  const sendMut = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Não autenticado");
      await insertUserMessage(user.id, text);
      const fresh = await fetchChatHistory();
      qc.setQueryData(["chat", "history"], fresh);
      await runAssistantTurn(fresh);
    },
    onMutate: () => setBusy(true),
    onSettled: () => setBusy(false),
    onError: (e: Error) => toast.error(e.message),
  });

  const confirmMut = useMutation({
    mutationFn: async (msg: ChatMessage) => {
      if (!user) return;
      const result = await executeToolAction(
        msg.tool_name!,
        msg.tool_args ?? {},
        user.id,
      );
      if (!result.ok) {
        await updateMessageStatus(msg.id, "cancelled", { error: result.error });
        throw new Error(result.error ?? "Falha ao executar");
      }
      await updateMessageStatus(msg.id, "confirmed", result.result ?? { ok: true });
      const fresh = await fetchChatHistory();
      qc.setQueryData(["chat", "history"], fresh);
      await runAssistantTurn(fresh);
    },
    onMutate: () => setBusy(true),
    onSettled: () => setBusy(false),
    onSuccess: () => {
      toast.success("Ação executada");
      refreshTasks();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelMut = useMutation({
    mutationFn: async (msg: ChatMessage) => {
      await updateMessageStatus(msg.id, "cancelled");
    },
    onSuccess: () => refresh(),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    sendMut.mutate(text);
  }

  const hasPending = useMemo(
    () => history.some((m) => m.status === "pending_confirmation"),
    [history],
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center justify-between border-b border-border/60 px-6 py-4 md:px-10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold tracking-tight">Chat IA</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => clearMut.mutate()}
          disabled={history.length === 0 || busy}
          className="text-muted-foreground"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 md:px-10"
      >
        <div className="mx-auto max-w-3xl space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <EmptyState />
          ) : (
            history.map((m) => (
              <MessageBubble
                key={m.id}
                msg={m}
                onConfirm={() => confirmMut.mutate(m)}
                onCancel={() => cancelMut.mutate(m)}
                busy={busy}
              />
            ))
          )}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Pensando...
            </div>
          )}
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border/60 bg-background/60 px-4 py-4 md:px-10"
      >
        <div className="mx-auto flex max-w-3xl gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              hasPending
                ? "Confirme ou cancele a ação acima antes de continuar..."
                : "Pergunte algo ou peça para criar/atualizar tarefas..."
            }
            disabled={busy || hasPending}
            rows={2}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
              }
            }}
            className="min-h-[56px] resize-none"
          />
          <Button
            type="submit"
            disabled={busy || hasPending || input.trim().length === 0}
            size="icon"
            className="h-[56px] w-[56px] shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-3xl text-xs text-muted-foreground">
          Enter envia · Shift+Enter quebra linha
        </p>
      </form>
    </div>
  );
}

function EmptyState() {
  const suggestions = [
    "Quais tarefas estão atrasadas?",
    "Resuma o que tenho para hoje",
    "Crie uma tarefa 'Revisar contrato' no projeto Marketing com prioridade alta",
    "Mova a tarefa X para concluído",
  ];
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h2 className="text-lg font-semibold">Converse com a IA</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Ela pode ler seus projetos e propor ações (você confirma antes de
        executar).
      </p>
      <div className="mx-auto mt-6 grid max-w-xl gap-2 text-left">
        {suggestions.map((s) => (
          <div
            key={s}
            className="rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm text-muted-foreground"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  onConfirm,
  onCancel,
  busy,
}: {
  msg: ChatMessage;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
          {msg.content}
        </div>
      </div>
    );
  }

  // assistant
  if (msg.tool_name && msg.status !== "complete") {
    return (
      <ActionProposalCard
        msg={msg}
        onConfirm={onConfirm}
        onCancel={onCancel}
        busy={busy}
      />
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[90%] rounded-2xl rounded-bl-sm bg-card/60 px-4 py-2 text-sm">
        {msg.content ? (
          <div className="prose prose-sm prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-headings:my-2">
            <ReactMarkdown>{msg.content}</ReactMarkdown>
          </div>
        ) : (
          <span className="text-muted-foreground italic">(vazio)</span>
        )}
      </div>
    </div>
  );
}

function ActionProposalCard({
  msg,
  onConfirm,
  onCancel,
  busy,
}: {
  msg: ChatMessage;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const label = ACTION_LABELS[msg.tool_name ?? ""] ?? msg.tool_name;
  const args = msg.tool_args ?? {};
  const pending = msg.status === "pending_confirmation";
  const confirmed = msg.status === "confirmed";
  const cancelled = msg.status === "cancelled";

  return (
    <div className="flex justify-start">
      <div
        className={cn(
          "w-full max-w-[90%] rounded-2xl rounded-bl-sm border p-4 text-sm",
          pending && "border-primary/40 bg-primary/5",
          confirmed && "border-emerald-500/30 bg-emerald-500/5",
          cancelled && "border-border/60 bg-muted/30 opacity-70",
        )}
      >
        <div className="flex items-center gap-2 font-medium">
          <Wrench className="h-4 w-4 text-primary" />
          <span>{label}</span>
          {confirmed && (
            <span className="ml-auto text-xs text-emerald-400">✓ Executada</span>
          )}
          {cancelled && (
            <span className="ml-auto text-xs text-muted-foreground">
              Cancelada
            </span>
          )}
        </div>
        <dl className="mt-2 grid gap-1 text-xs">
          {Object.entries(args).map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="text-muted-foreground">{k}:</dt>
              <dd className="break-all font-mono text-foreground/90">
                {typeof v === "string" ? v : JSON.stringify(v)}
              </dd>
            </div>
          ))}
        </dl>
        {pending && (
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={busy}
              className="gap-1"
            >
              <Check className="h-4 w-4" /> Confirmar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              disabled={busy}
              className="gap-1"
            >
              <X className="h-4 w-4" /> Cancelar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
