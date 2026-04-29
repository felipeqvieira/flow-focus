import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  buildInviteUrl,
  createInvitation,
  projectInvitationsQueryOptions,
  revokeInvitation,
  type ProjectRole,
} from "@/lib/invitations";
import { Copy, X, Link2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  invitedBy: string;
};

export function InviteMembersDialog({ open, onOpenChange, projectId, invitedBy }: Props) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("editor");
  const qc = useQueryClient();
  const invitesQuery = useQuery({
    ...projectInvitationsQueryOptions(projectId),
    enabled: open,
  });

  const createMut = useMutation({
    mutationFn: createInvitation,
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["project-invitations", projectId] });
      const url = buildInviteUrl(inv.token);
      navigator.clipboard?.writeText(url).catch(() => {});
      toast.success("Convite criado e link copiado!");
      setEmail("");
    },
    onError: (e: Error) => {
      const msg = e.message ?? "";
      if (msg.includes("uniq_pending_invite")) {
        toast.error("Já existe um convite pendente para este email.");
      } else {
        toast.error(msg || "Erro ao criar convite");
      }
    },
  });

  const revokeMut = useMutation({
    mutationFn: revokeInvitation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-invitations", projectId] });
      toast.success("Convite revogado");
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro"),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      toast.error("Email inválido");
      return;
    }
    createMut.mutate({ projectId, email: trimmed, role, invitedBy });
  };

  const copyLink = (token: string) => {
    const url = buildInviteUrl(token);
    navigator.clipboard?.writeText(url);
    toast.success("Link copiado!");
  };

  const pending = (invitesQuery.data ?? []).filter((i) => i.status === "pending");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Convidar membros</DialogTitle>
          <DialogDescription>
            Gere um link de convite e compartilhe com quem você quer adicionar ao projeto.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-[1fr_140px] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pessoa@email.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Permissão</Label>
              <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" disabled={createMut.isPending} className="w-full">
            {createMut.isPending ? "Gerando..." : "Gerar link de convite"}
          </Button>
        </form>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Convites pendentes</h3>
            <span className="text-xs text-muted-foreground">{pending.length}</span>
          </div>
          {invitesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>
          ) : (
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {pending.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate">{inv.email}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {inv.role === "editor" ? "Editor" : "Visualizador"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Expira em {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => copyLink(inv.token)}
                    title="Copiar link"
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => revokeMut.mutate(inv.id)}
                    disabled={revokeMut.isPending}
                    title="Revogar"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
