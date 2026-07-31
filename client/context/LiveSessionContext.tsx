"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getEvent } from "../lib/api";
import type { EventDto } from "../lib/types";

// Scoped live session — LOCKED to a single event (the /c/:slug and /l/:slug
// dashboards). There is deliberately no competition picker and no
// cross-competition browsing: every dashboard belongs to exactly one
// competition/league (owner decision 2026-07-15). The `liveStartedAt`-derived
// countdown still survives reloads (§3.4).
interface LiveSession {
  eventId: string;
  event: EventDto | null;
  loading: boolean;
  error: string | null;
}

const LiveSessionContext = createContext<LiveSession | null>(null);

export function LiveSessionProvider({
  children,
  fixedEventId,
}: {
  children: ReactNode;
  fixedEventId: string;
}) {
  const [event, setEvent] = useState<EventDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getEvent(fixedEventId)
      .then((ev) => active && setEvent(ev))
      .catch((e) => active && setError((e as Error).message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [fixedEventId]);

  const value = useMemo<LiveSession>(
    () => ({ eventId: fixedEventId, event, loading, error }),
    [fixedEventId, event, loading, error]
  );

  return (
    <LiveSessionContext.Provider value={value}>
      {children}
    </LiveSessionContext.Provider>
  );
}

export function useLiveSession(): LiveSession {
  const ctx = useContext(LiveSessionContext);
  if (!ctx) {
    throw new Error("useLiveSession must be used within a LiveSessionProvider");
  }
  return ctx;
}
