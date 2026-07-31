// Client-side Freestyle rubric metadata — drives the judge panel UI, the review
// stats, and the timeline labels. Element keys mirror the server scorer
// (server/src/scoring/freestyle.ts); each element is judged 0..2.5.

export interface FreestyleElement {
  key: string;
  he: string; // short Hebrew label
  en: string; // English term from the rulebook
}

export interface FreestylePanelDef {
  key: "dog" | "player" | "team";
  he: string;
  /** Only the top-N elements count toward the panel total (team = 4 of 7). */
  counted?: number;
  elements: FreestyleElement[];
}

export const FREESTYLE_PANELS: FreestylePanelDef[] = [
  {
    key: "dog",
    he: "שופט כלב",
    elements: [
      { key: "driveprey", he: "ציד", en: "Drive Prey" },
      { key: "retrieval", he: "הבאה", en: "Retrieval" },
      { key: "athleticism", he: "אתלטיות", en: "Athleticism" },
      { key: "grip", he: "אחיזה", en: "Grip" },
    ],
  },
  {
    key: "player",
    he: "שופט שחקן",
    elements: [
      { key: "presentation", he: "נוכחות במגרש", en: "Field Presentation" },
      { key: "releaseDiversity", he: "שחרורים וזריקות", en: "Release Diversity" },
      { key: "discManagement", he: "ניהול דיסקים", en: "Disc Management" },
      { key: "rhythmicTeam", he: "תנועה משותפת", en: "Rhythmic Team" },
    ],
  },
  {
    key: "team",
    he: "שופט צוות",
    counted: 4,
    elements: [
      { key: "overs", he: "שני אוברים", en: "Overs" },
      { key: "vaults", he: "שני וולטים", en: "Vaults" },
      { key: "multiple", he: "מולטיפול", en: "Multiple" },
      { key: "dogcatches", he: "שני דוג קאצ'", en: "Dog Catches" },
      { key: "jointMove", he: "תנועה משותפת", en: "Joint Move" },
      { key: "passing", he: "פסינג", en: "Passing" },
      { key: "directional", he: "תנועה כיוונית במרחק", en: "Directional Distance" },
    ],
  },
];

export const FREESTYLE_EXECUTION = { key: "execution", he: "שופט ביצוע" } as const;

/** The four panel judges — each scores from their own tablet and finishes alone. */
export type FreestyleRole = "dog" | "player" | "team" | "execution";
export const FREESTYLE_ROLES: FreestyleRole[] = [
  "dog",
  "player",
  "team",
  "execution",
];
export const FREESTYLE_PANEL_COUNT = FREESTYLE_ROLES.length;

/** Which tablet (panel role) this judge is officiating, persisted per device. */
export const FREESTYLE_ROLE_STORAGE_KEY = "jgames.freestyle.role";

export const FREESTYLE_ROLE_LABELS: Record<FreestyleRole, string> = {
  dog: "שופט כלב",
  player: "שופט שחקן",
  team: "שופט צוות",
  execution: "שופט ביצוע",
};

/** Vaults aren't scored in the Beginner category (rulebook p.31). */
export const FREESTYLE_BEGINNER_HIDDEN = new Set<string>(["vaults"]);

export const FREESTYLE_ELEMENT_MAX = 2.5;
export const FREESTYLE_ELEMENT_STEP = 0.5;

/** Selectable element scores: 0, 0.5, 1, 1.5, 2, 2.5. */
export const FREESTYLE_SCORE_STEPS: number[] = Array.from(
  { length: Math.round(FREESTYLE_ELEMENT_MAX / FREESTYLE_ELEMENT_STEP) + 1 },
  (_, i) => i * FREESTYLE_ELEMENT_STEP
);

// element key → { panelHe, he } for the timeline / stats lookups.
const ELEMENT_INDEX: Record<string, { panelHe: string; he: string }> = {};
for (const panel of FREESTYLE_PANELS) {
  for (const el of panel.elements) {
    ELEMENT_INDEX[el.key] = { panelHe: panel.he, he: el.he };
  }
}

/** "שופט כלב · אתלטיות" for a given element key. */
export function freestyleElementLabel(key: string): string {
  const e = ELEMENT_INDEX[key];
  return e ? `${e.panelHe} · ${e.he}` : key;
}
