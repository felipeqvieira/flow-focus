import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="px-6 py-8 md:px-10">
      <h1 className="text-xl font-semibold tracking-tight">Chat IA</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Conversa com a IA para criar e gerenciar tarefas. Em construção — Fase 5.
      </p>
    </div>
  );
}
