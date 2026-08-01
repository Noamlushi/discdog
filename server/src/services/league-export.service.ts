import * as XLSX from "xlsx";
import { ActionLog, League, Match } from "../models";
import { Discipline, ExperienceLevel, MatchStatus } from "../types";
import { computeLeagueStandings } from "./league-standings.service";
import { DISTANCE_COUNTED_THROWS, throwValue } from "../scoring/distance";
import { isMiss, num } from "../scoring/util";
import type { ActionData } from "../scoring/types";

// League workbook export (§3.4) — one .xlsx holding:
//   • "סיכום ליגה"  — the standings matrix: every team, its score per round and
//                      the official aggregate (best-of-N / sum).
//   • one sheet per generated round — every heat with its throw-by-throw log,
//     the same data the judge sees in "סיכום מקצה" (score, catches, misses,
//     success rate, and each throw's zone/bonuses/points).
// Built server-side because a CSV cannot carry multiple sheets.

const LEVEL_HE: Record<string, string> = {
  [ExperienceLevel.Beginner]: "מתחילים",
  [ExperienceLevel.Advanced]: "מתקדמים",
};

const SUMMARY_SHEET = "סיכום ליגה";

/** Excel forbids these in a sheet name and caps it at 31 chars. */
function sanitizeSheetName(name: string, taken: Set<string>): string {
  let base = name.replace(/[\\/?*[\]:]/g, "-").trim().slice(0, 31) || "סבב";
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  taken.add(candidate);
  return candidate;
}

/** Israel-local HH:mm for a scheduled time (stored as UTC). */
function timeHHmm(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(d);
}

/** Hebrew label for one logged Distance throw — mirrors the judge review line. */
function throwLabel(a: ActionData): string {
  if (isMiss(a)) return "החטאה";
  const bonuses: string[] = [];
  if (a.jumpBonus) bonuses.push("קפיצה +0.5");
  if (a.zoneBonus) bonuses.push("בונוס +0.5");
  return `אזור ${num(a.zone)}${bonuses.length ? ` (${bonuses.join(", ")})` : ""}`;
}

/**
 * Which throws feed the score — Distance counts the **best 5** (not the first
 * 5), so mark those rows. Misses are never candidates; they are worth 0 and
 * would otherwise occupy a slot in a short run.
 */
function countedThrowIndexes(actions: ActionData[]): Set<number> {
  const candidates = actions
    .map((a, i) => ({ i, value: isMiss(a) ? null : throwValue(a) }))
    .filter((c): c is { i: number; value: number } => c.value !== null)
    .sort((a, b) => b.value - a.value || a.i - b.i)
    .slice(0, DISTANCE_COUNTED_THROWS);
  return new Set(candidates.map((c) => c.i));
}

const YES = "✓";

interface NamedRef {
  name?: string;
}

function refName(ref: unknown): string {
  return (ref as NamedRef | null)?.name ?? "";
}

function widths(chars: number[]): { wch: number }[] {
  return chars.map((wch) => ({ wch }));
}

export interface LeagueWorkbook {
  buffer: Buffer;
  /** Hebrew file name (without directory), e.g. "ליגת החורף — תוצאות.xlsx". */
  fileName: string;
  /** ASCII-safe fallback for the Content-Disposition filename. */
  asciiFileName: string;
}

export async function buildLeagueWorkbook(
  leagueId: string
): Promise<LeagueWorkbook | null> {
  const league = await League.findById(leagueId).lean();
  if (!league) return null;
  const standings = await computeLeagueStandings(leagueId);
  if (!standings) return null;

  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] }; // Hebrew right-to-left view

  // ── Sheet 1: the standings matrix across every round ───────────────────────
  const cols = standings.rounds;
  const levels = (league.experienceLevels ?? [
    ExperienceLevel.Advanced,
    ExperienceLevel.Beginner,
  ]) as ExperienceLevel[];

  const summary: (string | number)[][] = [
    [league.name],
    [
      standings.scoring.mode === "bestOf"
        ? `דירוג לפי הטוב מ-${standings.scoring.bestN} סבבים · ${standings.roundsTotal} סבבים סה״כ`
        : `דירוג לפי סכום כל הסבבים · ${standings.roundsTotal} סבבים סה״כ`,
    ],
    [],
    [
      "רמה",
      "דירוג",
      "שחקן",
      "כלב",
      ...cols.map((c) => `ס${c.seq} · ${c.dateLabel} סבב ${c.roundIndex}`),
      "סבבים שרצו",
      "סה״כ",
    ],
  ];
  for (const level of levels) {
    for (const row of standings.levels[level] ?? []) {
      summary.push([
        LEVEL_HE[level] ?? level,
        row.rank,
        row.player ?? "",
        row.dog ?? "",
        ...cols.map((c) => {
          const cell = row.cells[c.key];
          return cell ? cell.score : "";
        }),
        row.attended,
        row.aggregate,
      ]);
    }
  }
  const summarySheet = XLSX.utils.aoa_to_sheet(summary);
  summarySheet["!cols"] = widths([
    12,
    7,
    20,
    16,
    ...cols.map(() => 10),
    11,
    9,
  ]);
  XLSX.utils.book_append_sheet(wb, summarySheet, SUMMARY_SHEET);

  // ── One sheet per generated round: every heat, throw by throw ──────────────
  const taken = new Set<string>([SUMMARY_SHEET]);
  for (const col of cols) {
    const sheetName = sanitizeSheetName(
      `ס${col.seq} - ${col.dateLabel}`,
      taken
    );
    if (!col.eventId) {
      // Round configured but not generated yet — keep the tab so the workbook
      // always mirrors the league's structure.
      const empty = XLSX.utils.aoa_to_sheet([
        [`${col.dateLabel} · סבב ${col.roundIndex}`],
        ["הסבב טרם נוצר."],
      ]);
      XLSX.utils.book_append_sheet(wb, empty, sheetName);
      continue;
    }

    const heats = await Match.find({ eventId: col.eventId })
      .sort({ pitchNumber: 1, scheduledTime: 1 })
      .populate("team.playerId", "name")
      .populate("team.dogId", "name")
      .lean();

    const logs = await ActionLog.find({
      matchId: { $in: heats.map((h) => h._id) },
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const byMatch = new Map<string, typeof logs>();
    for (const log of logs) {
      const key = String(log.matchId);
      const list = byMatch.get(key) ?? [];
      list.push(log);
      byMatch.set(key, list);
    }

    const rows: (string | number)[][] = [
      [
        "רמה",
        "שחקן",
        "כלב",
        "מגרש",
        "שעה",
        "סטטוס",
        "ניקוד מקצה",
        "תפיסות",
        "החטאות",
        "אחוז הצלחה",
        "# זריקה",
        "זמן",
        "תיאור",
        "אזור",
        "בונוס קפיצה",
        "בונוס אזור",
        "נק׳ לזריקה",
        `נספרה (${DISTANCE_COUNTED_THROWS} הטובות)`,
      ],
    ];

    for (const heat of heats) {
      const heatLogs = byMatch.get(String(heat._id)) ?? [];
      const actions = heatLogs.map((l) => (l.actionData ?? {}) as ActionData);
      const misses = actions.filter(isMiss).length;
      const catches = actions.length - misses;
      const rate =
        actions.length > 0 ? Math.round((catches / actions.length) * 100) : "";
      const counted =
        heat.categoryId === Discipline.Distance
          ? countedThrowIndexes(actions)
          : new Set<number>();
      // The heat's own columns repeat on every throw row so the sheet stays a
      // single sortable/filterable table.
      const heatCells: (string | number)[] = [
        LEVEL_HE[heat.experienceLevel] ?? heat.experienceLevel,
        refName(heat.team?.playerId) || (heat.isFinalsPlaceholder ? "— גמר —" : ""),
        refName(heat.team?.dogId),
        heat.pitchNumber,
        timeHHmm(heat.scheduledTime),
        heat.status === MatchStatus.Completed ? "הושלם" : "לא הושלם",
        typeof heat.finalScore === "number" ? heat.finalScore : "",
        catches,
        misses,
        rate,
      ];

      if (actions.length === 0) {
        rows.push([...heatCells, "", "", "אין זריקות רשומות", "", "", "", "", ""]);
        continue;
      }

      actions.forEach((a, i) => {
        const miss = isMiss(a);
        rows.push([
          ...heatCells,
          i + 1,
          heatLogs[i].timestamp,
          throwLabel(a),
          miss ? "" : num(a.zone),
          !miss && a.jumpBonus ? YES : "",
          !miss && a.zoneBonus ? YES : "",
          miss ? 0 : throwValue(a),
          counted.has(i) ? YES : "",
        ]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = widths([
      10, 18, 14, 7, 7, 11, 11, 8, 8, 11, 8, 8, 24, 7, 12, 12, 11, 16,
    ]);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const asciiBase =
    String(league.name).replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") ||
    "league";
  return {
    buffer,
    fileName: `${league.name} — תוצאות ליגה.xlsx`,
    asciiFileName: `league_results_${asciiBase}.xlsx`,
  };
}
