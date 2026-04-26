import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Inbox, LayoutGrid, FolderKanban, Sparkles, Settings } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/desk", label: "Meu Desk", icon: Inbox },
  { to: "/everything", label: "Tudo", icon: LayoutGrid },
  { to: "/chat", label: "Chat IA", icon: Sparkles },
] as const;

function AuthenticatedLayout() {
  // NOTE: Fase 2 adiciona a proteção de auth real (beforeLoad + redirect).
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
                className:
                  "bg-sidebar-accent text-sidebar-accent-foreground",
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

        <div className="mt-auto">
          <button className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent">
            <Settings className="h-4 w-4" />
            Configurações
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
