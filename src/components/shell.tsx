import { Link, useRouterState } from "@tanstack/react-router";
import { Compass, History, Scale, Settings, Telescope } from "lucide-react";
import type { ReactNode } from "react";

const LINKS = [
  { to: "/", label: "Desk", icon: Compass },
  { to: "/audit", label: "Audit", icon: Telescope },
  { to: "/history", label: "History", icon: History },
  { to: "/compare", label: "Compare", icon: Scale },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return (
    <div className="min-h-screen pb-24 md:pb-0">
      <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-primary focus:px-3 focus:py-2 focus:text-ink">
        Skip to content
      </a>
      <div className="mx-auto grid max-w-6xl md:grid-cols-[220px_1fr]">
        <aside className="hidden border-r border-line px-4 py-6 md:block">
          <Link to="/" className="block px-2">
            <p className="font-display text-2xl text-fg">Northline</p>
            <p className="text-sm text-muted">SEO audit desk</p>
          </Link>
          <nav className="mt-8 flex flex-col gap-1" aria-label="Primary">
            {LINKS.map((link) => {
              const active = link.to === "/" ? pathname === "/" : pathname.startsWith(link.to);
              const Icon = link.icon;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`flex min-h-11 items-center gap-2 rounded-full px-3 text-sm ${active ? "bg-surface-2 text-primary" : "text-fg hover:bg-surface"}`}
                >
                  <Icon className="size-4" aria-hidden />
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="min-w-0">
          <header className="flex items-center justify-between border-b border-line px-4 py-4 md:px-8">
            <Link to="/" className="font-display text-xl md:hidden">
              Northline
            </Link>
            <p className="hidden text-sm text-muted md:block">Public-site audits. Scores only count data that was actually collected.</p>
            <Link to="/audit" className="btn btn-primary text-sm">
              New audit
            </Link>
          </header>
          <main id="content" className="px-4 py-6 md:px-8">
            {children}
          </main>
        </div>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-line bg-bg md:hidden" aria-label="Primary">
        {LINKS.map((link) => {
          const active = link.to === "/" ? pathname === "/" : pathname.startsWith(link.to);
          const Icon = link.icon;
          return (
            <Link key={link.to} to={link.to} className={`flex min-h-14 flex-col items-center justify-center gap-1 text-xs ${active ? "text-primary" : "text-muted"}`}>
              <Icon className="size-4" aria-hidden />
              {link.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
