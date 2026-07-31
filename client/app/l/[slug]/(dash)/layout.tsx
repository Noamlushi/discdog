"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Gavel, ListOrdered, Radio } from "lucide-react";
import { getLeagueBySlug } from "../../../../lib/api";
import type { LeagueDto } from "../../../../lib/types";
import { useAuth } from "../../../../context/AuthContext";
import {
  ScopedLiveShell,
  type ScopedNavItem,
} from "../../../../components/live/ScopedLiveShell";

// Scoped league dashboard shell (/l/:slug/{standings,live}). Locked to this one
// league — the nav only switches between the league's aggregated standings and
// the live view of its currently-active round.
export default function LeagueDashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { slug } = useParams<{ slug: string }>();
  const { isManager } = useAuth();
  const [league, setLeague] = useState<LeagueDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeagueBySlug(slug)
      .then(setLeague)
      .catch(() => setLeague(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center text-cocoa/50">
        טוען…
      </div>
    );
  }
  if (!league) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center text-cocoa/50">
        הליגה לא נמצאה
      </div>
    );
  }

  const nav: ScopedNavItem[] = [
    { href: `/l/${slug}/standings`, label: "טבלת ליגה", icon: ListOrdered },
    { href: `/l/${slug}/live`, label: "לייב", icon: Radio },
    // Managers can jump to judging the league's active round; the scoped
    // /l/:slug/judge route is auth-gated so it stays hidden for the public nav.
    ...(isManager
      ? [{ href: `/l/${slug}/judge`, label: "שיפוט", icon: Gavel }]
      : []),
  ];

  const subtitle =
    league.scoring.mode === "bestOf"
      ? `הטוב מ-${league.scoring.bestN} סבבים`
      : "סכום כל הסבבים";

  return (
    <ScopedLiveShell title={league.name} subtitle={subtitle} nav={nav}>
      {children}
    </ScopedLiveShell>
  );
}
