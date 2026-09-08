"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getEventBySlug } from "../../../../lib/api";
import type { EventDto } from "../../../../lib/types";
import { RequireAuth } from "../../../../components/auth/RequireAuth";
import { JudgeSessionProvider } from "../../../../context/JudgeSessionContext";
import { JudgeScopeProvider } from "../../../../context/JudgeScopeContext";
import { JudgeShell } from "../../../../components/judge/JudgeShell";
import { useLeagueRoundRedirect } from "../../../../lib/useLeagueRoundRedirect";

// Scoped competition judging (/c/:slug/judge/{,scoring,log}). Resolves the event
// by slug and locks the judge session to it — no competition picker. Auth-gated
// to Admin/Organizer/Judge.
export default function CompetitionJudgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { slug } = useParams<{ slug: string }>();
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

  return (
    <RequireAuth roles={["Admin", "Organizer", "Judge"]}>
      {loading || redirecting ? (
        <div dir="rtl" className="grid min-h-screen place-items-center text-muted">
          טוען…
        </div>
      ) : !event ? (
        <div dir="rtl" className="grid min-h-screen place-items-center text-muted">
          התחרות לא נמצאה
        </div>
      ) : (
        <JudgeSessionProvider>
          <JudgeScopeProvider
            basePath={`/c/${slug}/judge`}
            event={event}
            up={{ href: `/c/${slug}`, label: "התחרות" }}
          >
            <JudgeShell>{children}</JudgeShell>
          </JudgeScopeProvider>
        </JudgeSessionProvider>
      )}
    </RequireAuth>
  );
}
