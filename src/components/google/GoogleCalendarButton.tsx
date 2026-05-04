import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Check, Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { disconnectGoogleFn } from "@/server/googleCalendar.functions";

async function fetchConnection(userId: string) {
  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select("user_id, google_email, created_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

type Props = { userId: string };

export function GoogleCalendarButton({ userId }: Props) {
  const qc = useQueryClient();
  const [starting, setStarting] = useState(false);

  const connQuery = useQuery({
    queryKey: ["google-conn", userId],
    queryFn: () => fetchConnection(userId),
  });

  // After OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const g = params.get("google");
    if (g === "connected") {
      toast.success("Google Calendar conectado!");
      qc.invalidateQueries({ queryKey: ["google-conn"] });
      params.delete("google");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (qs ? `?${qs}` : ""),
      );
    } else if (g === "error") {
      toast.error("Falha ao conectar Google Calendar");
      params.delete("google");
      const qs = params.toString();
      window.history.replaceState(
        {},
        "",
        window.location.pathname + (qs ? `?${qs}` : ""),
      );
    }
  }, [qc]);

  const disconnectMutation = useMutation({
    mutationFn: () => disconnectGoogleFn(),
    onSuccess: () => {
      toast.success("Google Calendar desconectado");
      qc.invalidateQueries({ queryKey: ["google-conn"] });
    },
    onError: () => toast.error("Erro ao desconectar"),
  });

  const handleConnect = async () => {
    try {
      setStarting(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }
      const res = await fetch(
        `/api/oauth/google/start?redirect=${encodeURIComponent(window.location.pathname)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } },
      );
      if (!res.ok) throw new Error("start failed");
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (e) {
      console.error(e);
      toast.error("Erro ao iniciar conexão");
      setStarting(false);
    }
  };

  const conn = connQuery.data;

  if (connQuery.isLoading) {
    return (
      <Button variant="ghost" size="sm" disabled className="gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </Button>
    );
  }

  if (!conn) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleConnect}
        disabled={starting}
        className="w-full justify-start gap-2"
      >
        {starting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Calendar className="h-3.5 w-3.5" />
        )}
        <span className="truncate">Conectar Google Calendar</span>
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-emerald-400" />
          <Check className="h-3 w-3 text-emerald-400" />
          <span className="hidden sm:inline text-xs">Calendar</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-3">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Conectado
          </p>
          <p className="text-sm">{conn.google_email ?? "Conta Google"}</p>
          <p className="text-xs text-muted-foreground">
            Tarefas com data em projetos com sync ativo viram eventos no seu
            Google Calendar.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => disconnectMutation.mutate()}
          disabled={disconnectMutation.isPending}
          className="w-full gap-2"
        >
          <Unplug className="h-3.5 w-3.5" />
          Desconectar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
