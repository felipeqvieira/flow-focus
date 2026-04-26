import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { Inbox, LayoutGrid, FolderKanban, Sparkles, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/desk", label: "Meu Desk", icon: Inbox },
  { to: "/everything", label: "Tudo", icon: LayoutGrid },
  { to: "/chat", label: "Chat IA", icon: Sparkles },
] as const;

function AuthenticatedLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    toast.success("Você saiu da sua conta.");
    navigate({ to: "/login" });
  };

  const initial = (user?.user_metadata?.display_name || user?.email || "?")
    .charAt(0)
    .toUpperCase();
  const displayName =
    user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Usuário";

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 md:flex">
        <div className="flex items-center gap-2 px-2 pb-6">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/40" />
          <span className="text-sm font-semibold tracking-tight">Flux</span>
        </div>

        <nav className="flex flex-col gap-0.5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeProps={{
                className: "bg-sidebar-accent text-sidebar-accent-foreground",
              }}
              className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 px-2">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Projetos
          </div>
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            <FolderKanban className="mr-1 inline h-3.5 w-3.5" />
            Em breve (Fase 4)
          </div>
        </div>

        <div className="mt-auto space-y-1 border-t border-sidebar-border pt-3">
          <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent">
            <Settings className="h-4 w-4" />
            Configurações
          </button>
          <div className="mt-2 flex items-center gap-2 rounded-md px-2 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">{displayName}</div>
              <div className="truncate text-[11px] text-muted-foreground">
                {user?.email}
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
