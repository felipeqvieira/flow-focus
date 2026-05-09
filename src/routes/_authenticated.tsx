import { useState } from "react";
import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Inbox, LayoutGrid, Sparkles, Settings, LogOut, Plus, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { projectsQueryOptions } from "@/lib/projects";
import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { NotificationsBell } from "@/components/notifications/NotificationsBell";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/desk", label: "My Desk", icon: Inbox },
  { to: "/everything", label: "Workplace", icon: LayoutGrid },
  { to: "/chat", label: "Chat IA", icon: Sparkles },
] as const;

function AuthenticatedLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  const projectsQuery = useQuery({
    ...projectsQueryOptions(),
    enabled: !!user,
  });

  const handleLogout = async () => {
    await signOut();
    toast.success("Você saiu da sua conta.");
    navigate({ to: "/login" });
  };

  const initial = (user?.user_metadata?.display_name || user?.email || "?").charAt(0).toUpperCase();
  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Usuário";

  const sidebar = (
    <>
      <div className="flex items-center justify-between px-2 pb-6">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary to-primary/40" />
          <span className="text-sm font-semibold tracking-tight">Flux</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationsBell />
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:bg-sidebar-accent md:hidden"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
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

      <div className="mt-6 flex-1 overflow-y-auto px-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Projetos
          </span>
          <button
            onClick={() => setNewProjectOpen(true)}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            title="Novo projeto"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex flex-col gap-0.5">
          {projectsQuery.data?.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Nenhum projeto ainda.</div>
          )}
          {projectsQuery.data?.map((p) => (
            <Link
              key={p.id}
              to="/projects/$id"
              params={{ id: p.id }}
              onClick={() => setSidebarOpen(false)}
              activeProps={{
                className: "bg-sidebar-accent text-sidebar-accent-foreground",
              }}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <span className="truncate">{p.name}</span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto space-y-1 border-t border-sidebar-border pt-3">
        <Link
          to="/settings"
          onClick={() => setSidebarOpen(false)}
          activeProps={{
            className: "bg-sidebar-accent text-sidebar-accent-foreground",
          }}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
        >
          <Settings className="h-4 w-4" />
          Configurações
        </Link>
        <div className="mt-2 flex items-center gap-2 rounded-md px-2 py-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium">{displayName}</div>
            <div className="truncate text-[11px] text-muted-foreground">{user?.email}</div>
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
    </>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Mobile drawer */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 transition-transform md:static md:w-60 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {sidebar}
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">Flux</span>
          <div className="ml-auto">
            <NotificationsBell />
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>

      {user && (
        <NewProjectDialog
          open={newProjectOpen}
          onOpenChange={setNewProjectOpen}
          ownerId={user.id}
          onCreated={(id) => navigate({ to: "/projects/$id", params: { id } })}
        />
      )}
    </div>
  );
}
