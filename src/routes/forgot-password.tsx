import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Recuperar senha — Flux" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        toast.error(error.message);
        return;
      }
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/40" />
          <span className="text-sm font-semibold tracking-tight">Flux</span>
        </Link>

        <div className="rounded-xl border border-border bg-card p-7 shadow-2xl shadow-black/30">
          {sent ? (
            <div className="text-center">
              <h1 className="text-xl font-semibold">Email enviado</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Se existe uma conta para <strong>{email}</strong>, você
                receberá um link para redefinir a senha.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm text-primary hover:underline"
              >
                Voltar para o login
              </Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold">Recuperar senha</h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Informe seu email e enviaremos um link para criar uma nova
                senha.
              </p>
              <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {loading ? "Enviando..." : "Enviar link"}
                </button>
              </form>
              <Link
                to="/login"
                className="mt-5 block text-center text-xs text-muted-foreground hover:text-foreground"
              >
                ← Voltar para o login
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
