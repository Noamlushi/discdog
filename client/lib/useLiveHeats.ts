"use client";

import { useCallback, useEffect, useState } from "react";
import { useSocket } from "../context/SocketContext";
import { getHeats } from "./api";
import { CLIENT_EVENTS, SERVER_EVENTS } from "./socketEvents";
import type { HeatDto, LiveScorePayload } from "./types";

// Live running score for one heat, mirrored from `live_score_updated` (§5.2).
export interface LiveScoreState {
  display: string;
  score: number | null;
  breakdown: Record<string, number> | null;
}

interface LiveHeats {
  heats: HeatDto[];
  scores: Record<string, LiveScoreState>;
  loading: boolean;
  error: string | null;
  isConnected: boolean;
  refresh: () => void;
}

// Subscribes a spectator view to one event: loads the heat list and keeps it
// fresh on every `match_status_changed`, while tracking per-heat running scores
// from `live_score_updated`. Backs both the Live Now grid and the schedule.
export function useLiveHeats(eventId: string | null): LiveHeats {
  const { socket, isConnected } = useSocket();
  const [heats, setHeats] = useState<HeatDto[]>([]);
  const [scores, setScores] = useState<Record<string, LiveScoreState>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (!eventId) {
      setHeats([]);
      return;
    }
    setLoading(true);
    getHeats({ eventId })
      .then((h) => {
        setHeats(h);
        setError(null);
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [eventId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!socket || !eventId) return;
    socket.emit(CLIENT_EVENTS.JOIN_EVENT_ROOM, eventId);

    // A status change can reshuffle who's live / on-deck and finalise a score,
    // so the simplest correct response is to re-pull the (small) heat list.
    const onStatus = () => refresh();
    const onScore = (p: LiveScorePayload) => {
      setScores((prev) => ({
        ...prev,
        [p.matchId]: {
          display: p.display,
          score: p.score,
          breakdown: p.breakdown,
        },
      }));
    };

    socket.on(SERVER_EVENTS.MATCH_STATUS_CHANGED, onStatus);
    socket.on(SERVER_EVENTS.LIVE_SCORE_UPDATED, onScore);
    return () => {
      socket.off(SERVER_EVENTS.MATCH_STATUS_CHANGED, onStatus);
      socket.off(SERVER_EVENTS.LIVE_SCORE_UPDATED, onScore);
    };
  }, [socket, eventId, refresh]);

  return { heats, scores, loading, error, isConnected, refresh };
}
