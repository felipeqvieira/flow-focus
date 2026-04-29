import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { acceptInvitation, fetchInvitationByToken } from "@/lib/invitations";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Users } from "lucide-react";

export const Route = createFileRoute("/invite/$token")({
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState<{ projectId: string } | null>(null);

  const inviteQuery = useQuery({
    queryKey: ["invite", token],
    queryFn: () => fetchInvitationByToken(token),
  });

  const acceptMut = useMutation({
    mutationFn: () => acceptInvitation(token),
    onSuccess: (res) => {
      if (res.success && res.project_id) {
        setAccepted({ projectId: res.project_id });
        toast.success("Convite aceito!");
      } else {
        toast.error(`Não foi possível aceitar: ${res.error ?? "erro"}`);
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Erro"),
  });

  // Auto-redirect after acceptance
  useEffect(() => {
    if (accepted) {
      const t = setTimeout(() => {
        navigate({ to: "/projects/$id", params: { id: accepted.projectId } });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [accepted, navigate]);

  const invite = inviteQuery.data;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Convite para projeto</CardTitle>
          {invite && (
            <CardDescription>
              {invite.invited_by_name ?? "Alguém"} convidou você para colaborar em{" "}
              <strong className="text-foreground">{invite.project_name}</strong>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {inviteQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !invite ? (
            <div className="text-center py-4 space-y-2">
              <XCircle className="h-10 w-10 text-destructive mx-auto" />
              <p className="text-sm text-muted-foreground">Convite não encontrado.</p>
            </div>
          ) : invite.status === "accepted" ? (
            <div className="text-center py-4 space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="text-sm text-muted-foreground">Este convite já foi aceito.</p>
              <Button asChild variant="outline" className="mt-2">
                <Link to="/everything">Ir para Workplace</Link>
              </Button>
            </div>
          ) : invite.status === "expired" || invite.status === "revoked" ? (
            <div className="text-center py-4 space-y-2">
              <XCircle className="h-10 w-10 text-destructive mx-auto" />
              <p className="text-sm text-muted-foreground">
                Este convite {invite.status === "expired" ? "expirou" : "foi revogado"}.
              </p>
            </div>
          ) : accepted ? (
            <div className="text-center py-4 space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="text-sm text-muted-foreground">Redirecionando...</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email convidado:</span>
                  <span>{invite.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Permissão:</span>
                  <span className="capitalize">
                    {invite.role === "editor" ? "Editor" : "Visualizador"}
                  </span>
                </div>
              </div>

              {authLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : !user ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground text-center">
                    Faça login ou crie uma conta para aceitar.
                  </p>
                  <Button asChild className="w-full">
                    <Link
                      to="/login"
                      search={{ redirect: `/invite/${token}` } as never}
                    >
                      Entrar para aceitar
                    </Link>
                  </Button>
                </div>
              ) : user.email && user.email.toLowerCase() !== invite.email.toLowerCase() ? (
                <div className="space-y-2">
                  <p className="text-sm text-amber-600 dark:text-amber-400 text-center">
                    Este convite foi enviado para <strong>{invite.email}</strong>, mas você está logado como <strong>{user.email}</strong>. Você pode aceitar mesmo assim.
                  </p>
                  <Button
                    onClick={() => acceptMut.mutate()}
                    disabled={acceptMut.isPending}
                    className="w-full"
                  >
                    {acceptMut.isPending ? "Aceitando..." : "Aceitar convite"}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => acceptMut.mutate()}
                  disabled={acceptMut.isPending}
                  className="w-full"
                >
                  {acceptMut.isPending ? "Aceitando..." : "Aceitar convite"}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
