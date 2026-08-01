"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarRange, Gavel, Radio, Trophy } from "lucide-react";
import { getEventBySlug } from "../../../../lib/api";
import type { EventDto } from "../../../../lib/types";
import { useAuth } from "../../../../context/AuthContext";
import { LiveSessionProvider } from "../../../../context/LiveSessionContext";
import {
  ScopedLiveShell,
  type ScopedNavItem,
} from "../../../../components/live/ScopedLiveShell";
import { useLeagueRoundRedirect } from "../../../../lib/useLeagueRoundRedirect";

// Scoped competition dashboard shell (/c/:slug/{live,leaderboard,schedule}).
// Locked to this one competition — no picker, and the nav only switches between
// this competition's own three views.
export default function CompetitionDashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { slug } = useParams<{ slug: string }>();
  const { isManager } = useAuth();
  const [event, setEvent] = useState<EventDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEventBySlug(slug)
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [slug]);

  // League rounds live in the league tree now; this URL forwards there.
  const redirecting = useLeagueRoundRedirect(event, slug);

  if (loading || redirecting) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center text-cocoa/50">
        טוען…
      </div>
    );
  }
  if (!event) {
    return (
      <div dir="rtl" className="grid min-h-screen place-items-center text-cocoa/50">
        התחרות לא נמצאה
      </div>
    );
  }

  const nav: ScopedNavItem[] = [
    { href: `/c/${slug}/live`, label: "לייב", icon: Radio },
    { href: `/c/${slug}/leaderboard`, label: "טבלת תוצאות", icon: Trophy },
    { href: `/c/${slug}/schedule`, label: "לוח זמנים", icon: CalendarRange },
    // Managers can jump straight to judging from inside the competition; the
    // scoped /c/:slug/judge route is auth-gated (Admin/Organizer/Judge) so it
    // stays hidden for the public spectator nav.
    ...(isManager
      ? [
          {
            href: `/c/${slug}/judge`,
            label: "שיפוט",
            icon: Gavel,
          },
        ]
      : []),
  ];

  return (
    <LiveSessionProvider fixedEventId={event._id}>
      <ScopedLiveShell title={event.name} nav={nav}>
        {children}
      </ScopedLiveShell>
    </LiveSessionProvider>
  );
}
