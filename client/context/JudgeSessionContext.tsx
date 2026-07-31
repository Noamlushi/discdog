"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { HeatDto } from "../lib/types";

// Holds the judge's working session across the On-Deck → Scoring routes: which
// event/pitch they're officiating, the active heat, and when its run started.
// `runStartedAt` is an epoch ms so the SmartTimer can recompute elapsed time on
// remount — surviving navigation and re-renders (§6.2).
interface JudgeSession {
  eventId: string | null;
  pitch: number | null;
  activeHeat: HeatDto | null;
  runStartedAt: number | null;
  setEventId: (id: string | null) => void;
  setPitch: (n: number | null) => void;
  startRun: (heat: HeatDto) => void;
  endRun: () => void;
}

const JudgeSessionContext = createContext<JudgeSession | null>(null);

export function JudgeSessionProvider({ children }: { children: ReactNode }) {
  const [eventId, setEventId] = useState<string | null>(null);
  const [pitch, setPitch] = useState<number | null>(null);
  const [activeHeat, setActiveHeat] = useState<HeatDto | null>(null);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);

  const startRun = (heat: HeatDto) => {
    setActiveHeat(heat);
    setRunStartedAt(Date.now());
  };
  const endRun = () => {
    setActiveHeat(null);
    setRunStartedAt(null);
  };

  return (
    <JudgeSessionContext.Provider
      value={{
        eventId,
        pitch,
        activeHeat,
        runStartedAt,
        setEventId,
        setPitch,
        startRun,
        endRun,
      }}
    >
      {children}
    </JudgeSessionContext.Provider>
  );
}

export function useJudgeSession(): JudgeSession {
  const ctx = useContext(JudgeSessionContext);
  if (!ctx) {
    throw new Error("useJudgeSession must be used within a JudgeSessionProvider");
  }
  return ctx;
}
