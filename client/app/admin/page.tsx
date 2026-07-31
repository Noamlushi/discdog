// §3.2 Admin dashboard
import Link from "next/link";
import { CalendarRange, ListOrdered, Trophy, Upload, Settings } from "lucide-react";

const CARDS = [
  {
    href: "/admin/events",
    icon: Trophy,
    title: "תחרויות",
    description: "צור וניהל תחרויות, צפה בסטטוס",
    cta: "כניסה",
  },
  {
    href: "/admin/leagues",
    icon: ListOrdered,
    title: "ליגות",
    description: "צור וניהל ליגות דיסטנס, מועדים וסבבים",
    cta: "כניסה",
  },
  {
    href: "/admin/import",
    icon: Upload,
    title: "ייבוא מתחרים",
    description: "העלה קובץ Excel / CSV עם רשימת הכלבים והמקצים",
    cta: "כניסה",
  },
  {
    href: "/admin/schedule",
    icon: CalendarRange,
    title: "סדר עלייה",
    description: "הפק ועדוך את לוח הזמנים לתחרות",
    cta: "כניסה",
  },
  {
    href: "/admin/settings",
    icon: Settings,
    title: "הגדרות",
    description: "פרמטרים של המערכת",
    cta: "כניסה",
  },
];

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black tracking-tight">Admin Dashboard</h1>
        <p className="mt-1 text-muted">
          ניהול תחרויות J&apos;GAMES
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {CARDS.map(({ href, icon: Icon, title, description, cta }) => (
          <Link
            key={href}
            href={href}
            className="group ds-card flex flex-col p-6 transition hover:border-accent/40 hover:shadow-glow"
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <Icon className="h-5 w-5" />
            </span>
            <h2 className="font-extrabold">{title}</h2>
            <p className="mt-1 flex-1 text-sm text-muted">{description}</p>
            <span className="mt-4 text-sm font-bold text-accent group-hover:underline">{cta} →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
