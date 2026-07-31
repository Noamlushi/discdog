// Renders one persisted judging action (ActionLog.actionData) as a readable
// Hebrew line for the throw-by-throw review timeline. Mirrors the action shapes
// the per-discipline scorers emit (components/judge/scorers/*) and the server
// scores (server/src/scoring/*).

import { freestyleElementLabel } from "./freestyle";

export type ActionKind = "catch" | "miss" | "info";

export interface ActionLabel {
  text: string;
  kind: ActionKind;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const AGILITY_ZONE_HE: Record<string, string> = {
  cyan: "ציאן",
  red: "אדום",
  jackpot: "ג'קפוט",
};

export function describeAction(
  categoryId: string,
  data: Record<string, unknown>
): ActionLabel {
  // Shared shapes first.
  if (data.miss === true) return { text: "החטאה", kind: "miss" };
  if (data.completed === true) {
    return { text: "סיום — עצירת שעון", kind: "info" };
  }

  switch (categoryId) {
    case "Distance":
    case "IceDrop": {
      const bonuses: string[] = [];
      if (data.jumpBonus) bonuses.push("קפיצה +0.5");
      if (data.zoneBonus) bonuses.push("בונוס +0.5");
      const suffix = bonuses.length ? ` (${bonuses.join(", ")})` : "";
      return { text: `אזור ${n(data.zone)}${suffix}`, kind: "catch" };
    }

    case "Shuffle":
      return { text: "תפיסה", kind: "catch" };

    case "WheelOfFortune":
      return data.area === "inner"
        ? { text: "ריבוע פנימי (10)", kind: "catch" }
        : { text: "ריבוע חיצוני (5)", kind: "catch" };

    case "Agility":
      if (data.type === "obstacle") return { text: "מכשול (+5)", kind: "catch" };
      return {
        text: `תפיסה — ${AGILITY_ZONE_HE[String(data.zone)] ?? String(data.zone)}`,
        kind: "catch",
      };

    case "CrissCross":
      if (data.jackpot) return { text: "ג'קפוט (+2)", kind: "catch" };
      return { text: `אזור ${n(data.zone)} (${n(data.zone)} נק')`, kind: "catch" };

    case "MultipleChallenge": {
      const seq = ["ציאן", "אדום", "סגול", "ג'קפוט"];
      const z = n(data.zone);
      return { text: `תפיסה ${z}: ${seq[z - 1] ?? ""}`.trim(), kind: "catch" };
    }

    case "JTrail":
    case "TimeTrail":
      return { text: "תפיסה", kind: "catch" };

    case "Freestyle":
      if (data.role === "execution") {
        return data.outcome === "catch"
          ? { text: "שופט ביצוע · תפיסה", kind: "catch" }
          : { text: "שופט ביצוע · החטאה", kind: "miss" };
      }
      return {
        text: `${freestyleElementLabel(String(data.element))}: ${n(
          data.score
        ).toFixed(1)}/2.5`,
        kind: "info",
      };

    default:
      return { text: JSON.stringify(data), kind: "info" };
  }
}
