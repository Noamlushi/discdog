"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { EventDto } from "../lib/types";
import { useJudgeSession } from "./JudgeSessionContext";

// Locks the judge session to one competition/league round resolved from the URL
// slug. The scoped judge routes (/c/:slug/judge, /l/:slug/judge) mount this so
// there is NO competition picker — the event is fixed, and `basePath` scopes the
// On-Deck → Scoring → Log navigation to that same route subtree.
interface JudgeScopeValue {
  /** Route prefix for this judge surface, e.g. "/c/my-comp/judge". */
  basePath: string;
  /** The competition (or league round) being judged. */
  event: EventDto;
}

const JudgeScopeContext = createContext<JudgeScopeValue | null>(null);

export function JudgeScopeProvider({
  basePath,
  event,
  children,
}: {
  basePath: string;
  event: EventDto;
  children: ReactNode;
}) {
  const { eventId, setEventId, setPitch } = useJudgeSession();

  // Adopt the resolved event as the locked session target. Single-pitch events
  // (e.g. a Distance league round) skip the pitch picker.
  useEffect(() => {
    if (event._id !== eventId) {
      setEventId(event._id);
      setPitch(event.activePitches === 1 ? 1 : null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event._id]);

  return (
    <JudgeScopeContext.Provider value={{ basePath, event }}>
      {children}
    </JudgeScopeContext.Provider>
  );
}

export function useJudgeScope(): JudgeScopeValue {
  const ctx = useContext(JudgeScopeContext);
  if (!ctx) throw new Error("useJudgeScope must be used within JudgeScopeProvider");
  return ctx;
}
