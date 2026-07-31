// Small formatting helpers shared by the discipline scoring modules.

/** Format points, dropping a trailing ".0" — 18 → "18", 18.5 → "18.5". */
export function formatPoints(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Format elapsed seconds as mm:ss — 83 → "01:23". */
export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const mm = Math.floor(safe / 60);
  const ss = safe % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** Coerce an unknown action field to a finite number, or fall back. */
export function num(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * A logged miss — a failed attempt the judge taps so the team can review their
 * catch ratio afterwards. Misses score nothing; every discipline marks them the
 * same way: { miss: true }. Kept here so the per-discipline scorers stay in sync.
 */
export function isMiss(action: { miss?: unknown }): boolean {
  return action.miss === true;
}

/** Count the logged misses in an action list. */
export function countMisses(actions: { miss?: unknown }[]): number {
  return actions.filter(isMiss).length;
}
