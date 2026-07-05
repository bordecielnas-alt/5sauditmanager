import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, ClipboardCheck, ListChecks, Settings } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/audits", label: "Audits", icon: ClipboardCheck },
  { to: "/actions", label: "Plans d'actions", icon: ListChecks },
  { to: "/settings", label: "Paramètres", icon: Settings },
] as const;

export function AppLayout({ children }: { children?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <aside className="md:w-60 md:min-h-screen bg-sidebar text-sidebar-foreground flex md:flex-col">
        <div className="p-5 border-b border-sidebar-border flex items-center gap-2">
          <div className="h-9 w-9 rounded bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center font-bold">5S</div>
          <div>
            <div className="font-semibold leading-tight">Audit 5S</div>
            <div className="text-xs opacity-70">Industrial</div>
          </div>
        </div>
        <nav className="flex md:flex-col overflow-x-auto md:overflow-visible p-2 gap-1 flex-1">
          {nav.map((n) => {
            const active = n.to === "/" ? pathname === "/" : pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">{children ?? <Outlet />}</main>
    </div>
  );
}
