import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getSafeRedirectPath } from "@/lib/authRedirect";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Entrar — Flux" },
      { name: "description", content: "Acesse sua conta Flux." },
    ],
  }),
  component: LoginPage,
});

type Mode = "signin" | "signup";

function LoginPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const redirect = getSafeRedirectPath(search.redirect);
  const { signInWithPassword, signUpWithPassword, signInWithGoogle } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await signInWithPassword(email, password);
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            toast.error("Confirme seu email antes de entrar.");
          } else if (error.message.toLowerCase().includes("invalid")) {
            toast.error("Email ou senha incorretos.");
          } else {
            toast.error(error.message);
          }
          return;
        }
        window.location.assign(redirect);
      } else {
        if (!name.trim()) {
          toast.error("Informe seu nome.");
          return;
        }
        const { error } = await signUpWithPassword(email, password, name.trim());
        if (error) {
          if (error.message.toLowerCase().includes("already")) {
            toast.error("Este email já está cadastrado. Faça login.");
          } else {
            toast.error(error.message);
          }
          return;
        }
        setSignupSuccess(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle(redirect);
      if (result.error) {
        toast.error("Não foi possível entrar com Google.");
        return;
      }
      if (!result.redirected) window.location.assign(redirect);
    } finally {
      setLoading(false);
    }
  };

  if (signupSuccess) {
    return (
      <AuthShell>
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            ✉
          </div>
          <h1 className="text-xl font-semibold">Verifique seu email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enviamos um link de confirmação para <strong>{email}</strong>.
            Clique nele para ativar sua conta.
          </p>
          <button
            onClick={() => {
              setSignupSuccess(false);
              setMode("signin");
            }}
            className="mt-6 text-sm text-primary hover:underline"
          >
            Voltar para o login
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-semibold tracking-tight">
        {mode === "signin" ? "Entrar no Flux" : "Criar sua conta"}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {mode === "signin"
          ? "Bem-vindo de volta. Acesse seu Kanban."
          : "Comece a organizar suas tarefas em segundos."}
      </p>

      <button
        onClick={handleGoogle}
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent disabled:opacity-50"
      >
        <GoogleIcon />
        Continuar com Google
      </button>

      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === "signup" && (
          <Field
            label="Nome"
            type="text"
            value={name}
            onChange={setName}
            placeholder="Seu nome"
            autoComplete="name"
          />
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="voce@exemplo.com"
          autoComplete="email"
          required
        />
        <Field
          label="Senha"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={6}
          required
        />

        {mode === "signin" && (
          <div className="flex justify-end">
            <Link
              to="/forgot-password"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Esqueci minha senha
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? "Aguarde..." : mode === "signin" ? "Entrar" : "Criar conta"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {mode === "signin" ? "Não tem uma conta? " : "Já tem uma conta? "}
        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="font-medium text-foreground hover:underline"
        >
          {mode === "signin" ? "Criar conta" : "Entrar"}
        </button>
      </p>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />
      </div>
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/40" />
          <span className="text-sm font-semibold tracking-tight">Flux</span>
        </Link>
        <div className="rounded-xl border border-border bg-card p-7 shadow-2xl shadow-black/30">
          {children}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.3 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3l5.7-5.7C34 6.3 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.6 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.4 39.6 16.1 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C41.7 35.7 44 30.2 44 24c0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}
