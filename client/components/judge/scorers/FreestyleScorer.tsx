"use client";

import { useEffect, useState } from "react";
import { Check, Trophy, XCircle } from "lucide-react";
import type { ScorerProps } from "./types";
import {
  FREESTYLE_PANELS,
  FREESTYLE_EXECUTION,
  FREESTYLE_BEGINNER_HIDDEN,
  FREESTYLE_SCORE_STEPS,
  FREESTYLE_ROLE_STORAGE_KEY,
  FREESTYLE_PANEL_COUNT,
  type FreestylePanelDef,
} from "../../../lib/freestyle";

// פריסטייל (Freestyle) — deep 4-judge panel (§5.2 / server scoring/freestyle.ts).
// Each tablet is one judge: dog / player / team score 0..2.5 per element; the
// execution judge just taps catch / miss and the catch ratio is computed. The
// freestyle_sync broadcast keeps the live summary in step across all four.
//
// action: { role, element, score } | { role: "execution", outcome }

type RoleKey = "dog" | "player" | "team" | "execution";

const ROLE_TABS: { key: RoleKey; he: string }[] = [
  ...FREESTYLE_PANELS.map((p) => ({ key: p.key as RoleKey, he: p.he })),
  { key: FREESTYLE_EXECUTION.key, he: FREESTYLE_EXECUTION.he },
];

export function FreestyleScorer({
  heat,
  onAction,
  disabled,
  score,
  onFinish,
}: ScorerProps) {
  const [role, setRole] = useState<RoleKey>("dog");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(FREESTYLE_ROLE_STORAGE_KEY) as RoleKey | null;
    if (saved && ROLE_TABS.some((r) => r.key === saved)) setRole(saved);
  }, []);

  const pickRole = (r: RoleKey) => {
    setRole(r);
    localStorage.setItem(FREESTYLE_ROLE_STORAGE_KEY, r);
  };

  const breakdown: Record<string, number> = score?.breakdown ?? {};
  const panel = FREESTYLE_PANELS.find((p) => p.key === role);

  // Per-judge finish: only the current tablet's role is marked done. The heat
  // completes for everyone only once all four judges have finished (server-side),
  // so one judge's tap never ends the run for the rest. §5.2
  const myDone = (breakdown[`${role}Done`] ?? 0) > 0;

  const finishMine = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onAction({ role, done: true });
      onFinish?.();
    } finally {
      setSubmitting(false);
    }
  };

  const reopenMine = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onAction({ role, done: false });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div dir="rtl" className="space-y-5">
      {/* Which judge am I */}
      <div>
        <span className="mb-2 block text-sm font-bold text-ink">התפקיד שלי בפאנל</span>
        <div className="grid grid-cols-4 gap-2">
          {ROLE_TABS.map((r) => {
            const rDone = (breakdown[`${r.key}Done`] ?? 0) > 0;
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => pickRole(r.key)}
                aria-pressed={role === r.key}
                className={`relative flex h-12 items-center justify-center rounded-xl border px-1 text-xs font-bold transition ${
                  role === r.key
                    ? "border-lime bg-lime text-lime-ink shadow-glow"
                    : "border-line bg-surface-2 text-muted"
                }`}
              >
                {r.he}
                {rDone && (
                  <Check
                    className="absolute left-1 top-1 h-3.5 w-3.5 text-accent"
                    aria-label="סיים"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {role === "execution" ? (
        <ExecutionPanel breakdown={breakdown} onAction={onAction} disabled={disabled} />
      ) : panel ? (
        <ElementPanel
          panel={panel}
          beginner={heat.experienceLevel === "Beginner"}
          breakdown={breakdown}
          onAction={onAction}
          disabled={disabled}
        />
      ) : null}

      <PanelSummary breakdown={breakdown} total={score?.score ?? null} />

      {/* Per-judge finish — each panel judge finishes their own role alone. */}
      <FinishPanel
        breakdown={breakdown}
        myDone={myDone}
        submitting={submitting || !!disabled}
        onFinish={finishMine}
        onReopen={reopenMine}
      />
    </div>
  );
}

function FinishPanel({
  breakdown,
  myDone,
  submitting,
  onFinish,
  onReopen,
}: {
  breakdown: Record<string, number>;
  myDone: boolean;
  submitting: boolean;
  onFinish: () => void;
  onReopen: () => void;
}) {
  const done = breakdown.panelsDone ?? 0;
  const total = breakdown.panelsTotal ?? FREESTYLE_PANEL_COUNT;

  return (
    <div className="ds-card space-y-3 p-4">
      <p className="text-center text-sm text-muted">
        {done}/{total} שופטים סיימו. המקצה ייסגר רק כשכל הפאנל יסיים.
      </p>

      {myDone ? (
        <div className="space-y-2">
          <p className="flex items-center justify-center gap-2 rounded-xl bg-lime/15 px-3 py-2 text-sm font-bold text-accent">
            <Check className="h-5 w-5" /> סיימת את השיפוט שלך
          </p>
          <button
            type="button"
            onClick={onReopen}
            disabled={submitting}
            className="w-full rounded-xl py-2 text-sm font-medium text-muted underline-offset-2 hover:underline disabled:opacity-50"
          >
            לחצתי בטעות — החזר אותי לשיפוט
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onFinish}
          disabled={submitting}
          className="flex h-tap w-full items-center justify-center gap-2 rounded-2xl bg-lime text-lg font-black text-lime-ink shadow-glow transition active:scale-[0.99] disabled:opacity-50"
        >
          <Trophy className="h-6 w-6" />
          סיים את השיפוט שלי
        </button>
      )}
    </div>
  );
}

function ElementPanel({
  panel,
  beginner,
  breakdown,
  onAction,
  disabled,
}: {
  panel: FreestylePanelDef;
  beginner: boolean;
  breakdown: Record<string, number>;
  onAction: ScorerProps["onAction"];
  disabled?: boolean;
}) {
  const elements = panel.elements.filter(
    (e) => !(beginner && FREESTYLE_BEGINNER_HIDDEN.has(e.key))
  );

  // For the team panel, mark which elements currently make the counted top-4.
  const counted = new Set<string>();
  if (panel.counted) {
    [...elements]
      .sort((a, b) => (breakdown[b.key] ?? 0) - (breakdown[a.key] ?? 0))
      .slice(0, panel.counted)
      .forEach((e) => {
        if ((breakdown[e.key] ?? 0) > 0) counted.add(e.key);
      });
  }

  return (
    <div className="space-y-3">
      {panel.counted && (
        <p className="rounded-xl bg-accent/10 px-3 py-2 text-center text-xs font-bold text-accent">
          רק {panel.counted} האלמנטים הגבוהים נספרים (מתוך {panel.elements.length})
        </p>
      )}
      {elements.map((el) => {
        const current = breakdown[el.key];
        return (
          <div
            key={el.key}
            className={`rounded-2xl border bg-surface p-3 transition ${
              counted.has(el.key) ? "border-lime/60" : "border-line"
            }`}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-bold">
                {el.he}
                <span className="mr-1 text-xs font-normal text-muted">
                  {el.en}
                </span>
              </span>
              <span className="font-score text-sm tabular-nums text-muted">
                {current == null ? "—" : current.toFixed(1)}/2.5
              </span>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {FREESTYLE_SCORE_STEPS.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => onAction({ role: panel.key, element: el.key, score: n })}
                  className={`flex h-12 items-center justify-center rounded-lg border font-score text-base font-bold transition active:scale-[0.96] disabled:opacity-40 ${
                    current === n
                      ? "border-lime bg-lime text-lime-ink"
                      : "border-line bg-surface-2 text-ink"
                  }`}
                >
                  {n % 1 === 0 ? n : n.toFixed(1)}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ExecutionPanel({
  breakdown,
  onAction,
  disabled,
}: {
  breakdown: Record<string, number>;
  onAction: ScorerProps["onAction"];
  disabled?: boolean;
}) {
  const catches = breakdown.catches ?? 0;
  const throws = breakdown.throws ?? 0;
  const exec = breakdown.executionTotal ?? 0;

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted">
        הקש תפיסה/החטאה לכל זריקה. הציון = תפיסות ÷ זריקות × 10, מחושב אוטומטית.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction({ role: "execution", outcome: "catch" })}
          className="flex h-28 flex-col items-center justify-center gap-1 rounded-2xl bg-lime text-lime-ink shadow-glow transition active:scale-[0.98] disabled:opacity-40"
        >
          <Check className="h-8 w-8" />
          <span className="text-xl font-black">תפיסה</span>
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onAction({ role: "execution", outcome: "miss" })}
          className="flex h-28 flex-col items-center justify-center gap-1 rounded-2xl border border-danger/40 bg-danger/10 text-danger transition active:scale-[0.98] active:bg-danger/20 disabled:opacity-40"
        >
          <XCircle className="h-8 w-8" />
          <span className="text-xl font-black">החטאה</span>
        </button>
      </div>
      <div className="ds-card flex items-center justify-around p-4">
        <Stat label="תפיסות" value={String(catches)} />
        <Stat label="זריקות" value={String(throws)} />
        <Stat label="ציון ביצוע" value={exec.toFixed(1)} highlight />
      </div>
    </div>
  );
}

function PanelSummary({
  breakdown,
  total,
}: {
  breakdown: Record<string, number>;
  total: number | null;
}) {
  const rows: { he: string; value: number }[] = [
    { he: "שופט כלב", value: breakdown.dogTotal ?? 0 },
    { he: "שופט שחקן", value: breakdown.playerTotal ?? 0 },
    { he: "שופט צוות", value: breakdown.teamTotal ?? 0 },
    { he: "שופט ביצוע", value: breakdown.executionTotal ?? 0 },
  ];
  return (
    <div className="ds-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="ds-label">סיכום פאנל</span>
        <span className="font-score text-lg font-black tabular-nums text-accent">
          {(total ?? 0).toFixed(1)}/40
        </span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {rows.map((r) => (
          <div key={r.he} className="flex items-center justify-between text-sm">
            <span className="text-muted">{r.he}</span>
            <span className="font-score tabular-nums">{r.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <p className="ds-label">{label}</p>
      <p
        className={`mt-0.5 font-score text-2xl font-black tabular-nums ${
          highlight ? "text-accent" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
