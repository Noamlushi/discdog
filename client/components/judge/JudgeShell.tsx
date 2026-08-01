"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flag, Hand, ListChecks, Undo2 } from "lucide-react";
import { ThemeToggle } from "../ThemeToggle";
import { useJudgeScope } from "../../context/JudgeScopeContext";

// §3.3 / §8.2 Judge shell — mobile bottom nav with oversized tap targets, scoped
// to one competition/league round via JudgeScope's `basePath` (no picker). The
// competition name sits in the top strip so the judge always knows the context.
export function JudgeShell({ children }: { children: React.ReactNode }) {
  const { basePath, event, up } = useJudgeScope();
  const pathname = usePathname();

  // "Up" first: from a league round it climbs to the league, from a standalone
  // competition to that competition's portal. Without it the judging screens
  // had no way out at all.
  const nav = [
    ...(up ? [{ href: up.href, label: up.label, icon: Undo2 }] : []),
    { href: basePath, label: "הבא בתור", icon: Flag },
    { href: `${basePath}/scoring`, label: "ניקוד", icon: Hand },
    { href: `${basePath}/log`, label: "יומן", icon: ListChecks },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-arena text-ink">
      {/* Compact top strip — brand + competition name + theme switch. */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-sm font-black tracking-tight text-accent">
            J&apos;GAMES
          </span>
          <span className="truncate text-sm font-bold text-muted">
            · {event.name}
          </span>
        </div>
        <ThemeToggle />
      </div>

      {/* pb leaves room for the fixed bottom nav */}
      <main className="flex-1 p-4 pb-24">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-line bg-surface">
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
