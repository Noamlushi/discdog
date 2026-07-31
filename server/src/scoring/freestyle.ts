import { Discipline, ExperienceLevel } from "../types";
import type { DisciplineScorer, ActionData, ScoreResult } from "./types";
import { formatPoints, num } from "./util";

// פריסטייל (Freestyle) — rulebook pp.29–32 (deep rubric, owner-confirmed 2026-06-13).
// Judged live by a 4-tablet panel (§5.2 freestyle_sync), combined out of 40 —
// each panel contributes up to 10:
//
//   שופט כלב (dog)     — 4 elements × 2.5: drive prey, retrieval, athleticism, grip
//   שופט שחקן (player) — 4 elements × 2.5: field presentation, release diversity,
//                        disc management, rhythmic team
//   שופט צוות (team)   — 7 elements × 2.5, but ONLY THE TOP 4 COUNT (max 10):
//                        overs, vaults, multiple, dog-catches, joint move, passing,
//                        directional distance. (vaults isn't scored in Beginner —
//                        the judge just leaves it unscored → it won't make the top 4.)
//   שופט ביצוע (exec)  — computed: catches / throws × 10. The judge taps catch /
//                        miss per throw; we derive the ratio (e.g. 15/20 → 7.5).
//
// Each tablet re-submits per element, so a correction overwrites the last value:
//   { role: "dog" | "player" | "team", element: <key>, score: 0..2.5 }
//   { role: "execution", outcome: "catch" | "miss" }

export const FREESTYLE_PANELS = {
  dog: ["driveprey", "retrieval", "athleticism", "grip"],
  player: ["presentation", "releaseDiversity", "discManagement", "rhythmicTeam"],
  team: [
    "overs",
    "vaults",
    "multiple",
    "dogcatches",
    "jointMove",
    "passing",
    "directional",
  ],
} as const;

export type FreestylePanel = keyof typeof FREESTYLE_PANELS;

// The four judges that make up the panel. Each scores from their own tablet and
// finishes independently — the heat only completes once all four are done.
export const FREESTYLE_ROLES = ["dog", "player", "team", "execution"] as const;
export type FreestyleRole = (typeof FREESTYLE_ROLES)[number];
export const FREESTYLE_PANEL_COUNT = FREESTYLE_ROLES.length;

const ELEMENT_MAX = 2.5;
const PANEL_MAX = 10;
const PANEL_COUNT = 4;
const TEAM_COUNTED = 4; // only the top 4 of the team's seven elements count

const ROLE_SET = new Set<string>(FREESTYLE_ROLES);

/**
 * Per-judge "I'm done" state (last write wins, so an accidental finish can be
 * undone with `{ role, done: false }`). Each panel judge finishes on their own
 * tablet; one judge tapping finish must NOT end the heat for the others (§5.2).
 */
function doneRoles(actions: ActionData[]): Set<string> {
  const done: Record<string, boolean> = {};
  for (const a of actions) {
    if ("done" in a && a.role != null && ROLE_SET.has(String(a.role))) {
      done[String(a.role)] = Boolean(a.done);
    }
  }
  return new Set(Object.keys(done).filter((r) => done[r]));
}

// element key → which panel it belongs to (also the set of valid elements).
const ELEMENT_PANEL: Record<string, FreestylePanel> = {};
for (const panel of Object.keys(FREESTYLE_PANELS) as FreestylePanel[]) {
  for (const el of FREESTYLE_PANELS[panel]) ELEMENT_PANEL[el] = panel;
}

const clampElement = (v: number): number => Math.min(Math.max(v, 0), ELEMENT_MAX);
const round1 = (v: number): number => Math.round(v * 10) / 10;
const sum = (values: number[]): number => values.reduce((s, v) => s + v, 0);

/** Latest 0..2.5 score per scored element (last write wins, for corrections). */
function elementScores(actions: ActionData[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const a of actions) {
    if (a.element != null && String(a.element) in ELEMENT_PANEL) {
      scores[String(a.element)] = clampElement(num(a.score));
    }
  }
  return scores;
}

export const freestyle: DisciplineScorer = {
  key: Discipline.Freestyle,
  nameHe: "פריסטייל",
  discs: 10,
  direction: "desc",
  durationSeconds: (level) =>
    level === ExperienceLevel.Advanced ? 120 : 90,

  score(actions: ActionData[]): ScoreResult {
    const scores = elementScores(actions);

    const dogTotal = Math.min(
      sum(FREESTYLE_PANELS.dog.map((e) => scores[e] ?? 0)),
      PANEL_MAX
    );
    const playerTotal = Math.min(
      sum(FREESTYLE_PANELS.player.map((e) => scores[e] ?? 0)),
      PANEL_MAX
    );

    // Team: only the four highest-scoring of its seven elements count.
    const teamValues = FREESTYLE_PANELS.team
      .map((e) => scores[e] ?? 0)
      .sort((a, b) => b - a);
    const teamTotal = Math.min(sum(teamValues.slice(0, TEAM_COUNTED)), PANEL_MAX);

    // Execution: catches / throws × 10, derived from the catch/miss taps.
    let catches = 0;
    let throws = 0;
    for (const a of actions) {
      if (a.role !== "execution") continue;
      if (a.outcome === "catch") {
        catches += 1;
        throws += 1;
      } else if (a.outcome === "miss") {
        throws += 1;
      }
    }
    const executionTotal =
      throws > 0 ? round1(Math.min((catches / throws) * 10, PANEL_MAX)) : 0;

    const value = round1(
      Math.min(
        dogTotal + playerTotal + teamTotal + executionTotal,
        PANEL_MAX * PANEL_COUNT
      )
    );

    // Per-judge finish state, surfaced so every tablet (and the route's
    // completion check) can see who's still scoring.
    const done = doneRoles(actions);

    return {
      value,
      display: formatPoints(value),
      breakdown: {
        ...scores,
        dogTotal,
        playerTotal,
        teamTotal,
        executionTotal,
        catches,
        throws,
        dogDone: done.has("dog") ? 1 : 0,
        playerDone: done.has("player") ? 1 : 0,
        teamDone: done.has("team") ? 1 : 0,
        executionDone: done.has("execution") ? 1 : 0,
        panelsDone: done.size,
        panelsTotal: FREESTYLE_PANEL_COUNT,
      },
    };
  },
};
