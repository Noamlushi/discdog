"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { useSocket } from "../../context/SocketContext";
import { ThemeToggle } from "../ThemeToggle";

// Shell for the slug-scoped dashboards (/c/:slug/* and /l/:slug/*). Unlike the
// generic /live shell, there is NO competition picker — the dashboard is locked
// to one competition/league — and the bottom nav only switches between that
// entity's own views. This is the "no browsing between dashboards" behaviour.
export interface ScopedNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export function ScopedLiveShell({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
  subtitle?: string;
  nav: ScopedNavItem[];
  children: React.ReactNode;
}) {
  const { isConnected } = useSocket();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-arena text-ink">
      <div className="sticky top-0 z-10 border-b border-line bg-arena/80 px-4 py-3 backdrop-blur-md">
        <header className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime-bright text-lg shadow-glow">
              🐾
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-black leading-tight">{title}</p>
              {subtitle && (
                <p className="truncate text-xs font-semibold text-muted">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`ds-pill uppercase tracking-wide ${
                isConnected ? "ds-pill-ondeck" : "ds-pill-done"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "animate-pulse bg-accent" : "bg-muted"
                }`}
              />
              {isConnected ? "משדר" : "מתחבר…"}
            </span>
            <ThemeToggle />
          </div>
        </header>
      </div>

      <main className="mx-auto w-full max-w-6xl flex-1 p-4 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto flex max-w-6xl border-t border-line bg-surface/90 backdrop-blur-md">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-xs font-bold transition ${
                active ? "text-accent" : "text-muted hover:text-accent"
              }`}
            >
              {active && (
                <span className="absolute top-0 h-1 w-10 rounded-full bg-lime" />
              )}
              <Icon className="h-6 w-6" />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
