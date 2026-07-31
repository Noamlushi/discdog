import Link from "next/link";
import {
  CalendarRange,
  LayoutDashboard,
  ListOrdered,
  Settings,
  Trophy,
  Upload,
} from "lucide-react";
import { RequireManager } from "../../components/auth/RequireAuth";
import { ThemeToggle } from "../../components/ThemeToggle";

// §3.2 Admin shell — structural sidebar. Active-link highlighting (usePathname)
// comes later; kept static here to stay a pure placeholder.
const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", icon: Trophy },
  { href: "/admin/leagues", label: "Leagues", icon: ListOrdered },
  { href: "/admin/schedule", label: "Schedule", icon: CalendarRange },
  { href: "/admin/import", label: "Import", icon: Upload },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireManager>
      <div className="flex min-h-screen bg-arena text-ink">
        <aside className="hidden w-60 shrink-0 flex-col border-l border-line bg-surface p-4 md:flex">
          <div className="mb-6 flex items-center justify-between px-2">
            <span className="text-lg font-black text-accent">J&apos;GAMES Admin</span>
            <ThemeToggle />
          </div>
          <nav className="flex flex-col gap-1">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-muted transition hover:bg-surface-2 hover:text-ink"
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-6">
          {/* Mobile theme switch (sidebar is hidden < md) */}
          <div className="mb-4 flex justify-end md:hidden">
            <ThemeToggle />
          </div>
          {children}
        </main>
      </div>
    </RequireManager>
  );
}
