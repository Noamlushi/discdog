"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Gavel,
  LayoutDashboard,
  ListOrdered,
  Plus,
  RefreshCw,
  Trash2,
  Trophy,
  Upload,
  Users,
} from "lucide-react";
import {
  addLeagueRosterEntry,
  deleteLeagueRosterEntry,
  generateLeagueRound,
  getEvents,
  getLeagueBySlug,
  getLeagueRoster,
  importLeagueRoster,
} from "../../../lib/api";
import type {
  EventDto,
  LeagueDto,
  LeagueRosterEntryDto,
} from "../../../lib/types";
import { useAuth } from "../../../context/AuthContext";

// League portal (/l/:slug) — the shareable league URL. Public visitors see the
// dates, per-round links, and the standings dashboard. Managers also import the
// master roster once and generate each round (which materializes a Distance Event).
export default function LeaguePortalPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { isManager } = useAuth();
  const [league, setLeague] = useState<LeagueDto | null>(null);
  const [rounds, setRounds] = useState<EventDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Master-roster manual management (managers only).
  const [roster, setRoster] = useState<LeagueRosterEntryDto[]>([]);
  const [playerName, setPlayerName] = useState("");
  const [dogName, setDogName] = useState("");
  const [phone, setPhone] = useState("");
  const [level, setLevel] = useState<"Beginner" | "Advanced">("Beginner");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const lg = await getLeagueBySlug(slug);
    setLeague(lg);
    const [evs, rst] = await Promise.all([
      getEvents({ leagueId: lg._id }),
      getLeagueRoster(lg._id).catch(() => [] as LeagueRosterEntryDto[]),
    ]);
    setRounds(evs);
    setRoster(rst);
  }, [slug]);

  useEffect(() => {
    load()
      .catch(() => router.replace("/"))
      .finally(() => setLoading(false));
  }, [load, router]);

  // Default the add-team level to the league's first configured level.
  useEffect(() => {
    if (league?.experienceLevels.length && !league.experienceLevels.includes(level)) {
      setLevel(league.experienceLevels[0]);
    }
  }, [league, level]);

  // Find the generated Event for a (date, round), if any.
  const roundEvent = (dateId: string, roundIndex: number) =>
    rounds.find(
      (e) => e.leagueDateId === dateId && e.roundIndex === roundIndex
    );

  async function onGenerate(dateId: string, roundIndex: number) {
    if (!league) return;
    setBusy(`${dateId}:${roundIndex}`);
    setMsg(null);
    try {
      await generateLeagueRound(league._id, dateId, roundIndex);
      await load();
      setMsg("הסבב נוצר ותוזמן בהצלחה");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onImport(file: File) {
    if (!league) return;
    setBusy("import");
    setMsg(null);
    try {
      const summary = await importLeagueRoster(league._id, file);
      setMsg(
        `יובאו ${summary.registrationsCreated} רישומים (${summary.playersCreated} שחקנים חדשים)`
      );
      await load();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function onAddTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!league || !playerName.trim() || !dogName.trim()) return;
    setAdding(true);
    setMsg(null);
    try {
      const entry = await addLeagueRosterEntry(league._id, {
        playerName: playerName.trim(),
        dogName: dogName.trim(),
        phone: phone.trim() || undefined,
        experienceLevel: level,
      });
      setRoster((prev) =>
        prev.some((r) => r._id === entry._id) ? prev : [...prev, entry]
      );
      setPlayerName("");
      setDogName("");
      setPhone("");
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function onDeleteTeam(regId: string) {
    if (!league) return;
    try {
      await deleteLeagueRosterEntry(league._id, regId);
      setRoster((prev) => prev.filter((r) => r._id !== regId));
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  const levelLabel = (l: string) =>
    l === "Advanced" ? "מתקדמים" : "מתחילים";

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-arena text-muted">
        טוען…
      </main>
    );
  }
  if (!league) return null;

  return (
    <main className="min-h-screen bg-arena text-ink">
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
        <nav className="mb-6 flex items-center gap-1 text-sm text-muted">
          <Link href="/" className="hover:text-accent">
            תחרויות
          </Link>
          <ChevronRight className="h-4 w-4 rotate-180" />
          <span className="text-ink">{league.name}</span>
        </nav>

        <div className="mb-8 flex items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime-bright text-lime-ink shadow-glow">
            <ListOrdered className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              {league.name}
            </h1>
            <span className="text-sm font-semibold text-muted">
              {league.dates.length} מועדים ·{" "}
              {league.scoring.mode === "bestOf"
                ? `הטוב מ-${league.scoring.bestN} סבבים`
                : "סכום כל הסבבים"}
            </span>
          </div>
        </div>

        {/* Dashboard entry */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <Link
            href={`/l/${league.slug}/standings`}
            className="group ds-card flex flex-col p-6 transition hover:border-accent/50 hover:shadow-glow"
          >
            <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime-bright text-lime-ink shadow-glow transition group-hover:scale-105">
              <LayoutDashboard className="h-7 w-7" />
            </span>
            <h3 className="text-lg font-extrabold">דשבורד וטבלת ליגה</h3>
            <p className="mt-1 flex-1 text-sm text-muted">
              דירוג מצטבר לפי הסבבים הטובים ביותר
            </p>
          </Link>

          {isManager && (
            <div className="ds-card flex flex-col p-6">
              <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-lime to-lime-bright text-lime-ink shadow-glow">
                <Upload className="h-7 w-7" />
              </span>
              <h3 className="text-lg font-extrabold">ייבוא רוסטר</h3>
              <p className="mt-1 flex-1 text-sm text-muted">
                מייבאים פעם אחת; כל סבב משוכפל מהרשימה
              </p>
              <button
                onClick={() => fileRef.current?.click()}
                disabled={busy === "import"}
                className="ds-btn ds-btn-primary mt-4 px-4 py-2 disabled:opacity-50"
              >
                {busy === "import" ? "מייבא…" : "העלה קובץ"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImport(f);
                  e.target.value = "";
                }}
              />
            </div>
          )}
        </div>

        {msg && (
          <p className="mb-6 rounded-2xl border border-accent/25 bg-accent/10 px-5 py-3 text-sm font-bold text-accent">
            {msg}
          </p>
        )}

        {/* Master-roster manual management (managers only). The run order stays
            auto-generated by the scheduler — this only manages who's registered. */}
        {isManager && (
          <section className="ds-card mb-8 p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-lime to-lime-bright text-lime-ink shadow-glow">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-extrabold">רוסטר וסדר עלייה</h2>
                <p className="text-xs font-semibold text-muted">
                  {roster.length} מתחרים · הוספה ידנית או מקובץ
                </p>
              </div>
            </div>

            {/* Add-a-team form */}
            <form
              onSubmit={onAddTeam}
              className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"
            >
              <label className="flex flex-col gap-1 text-xs font-bold text-muted">
                שם המתחרה
                <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="שם מלא"
                  className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-muted">
                שם הכלב
                <input
                  value={dogName}
                  onChange={(e) => setDogName(e.target.value)}
                  placeholder="שם הכלב"
                  className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-accent"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-bold text-muted">
                רמה
                <select
                  value={level}
                  onChange={(e) =>
                    setLevel(e.target.value as "Beginner" | "Advanced")
                  }
                  className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-accent"
                >
                  {(league.experienceLevels.length
                    ? league.experienceLevels
                    : (["Beginner", "Advanced"] as const)
                  ).map((l) => (
                    <option key={l} value={l}>
                      {levelLabel(l)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                disabled={adding || !playerName.trim() || !dogName.trim()}
                className="ds-btn ds-btn-primary px-4 py-2 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {adding ? "מוסיף…" : "הוסף"}
              </button>
            </form>

            {/* Roster list (this order = the entry list; the scheduler still
                produces the final run order). */}
            {roster.length === 0 ? (
              <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">
                אין עדיין מתחרים — הוסיפו ידנית או העלו קובץ.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {roster.map((r, i) => (
                  <li
                    key={r._id}
                    className="flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-2.5"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-line bg-surface font-score text-xs font-black text-muted">
                      {i + 1}
                    </span>
                    <span className="flex-1 text-sm font-bold">
                      {r.playerName ?? "—"}
                      <span className="mx-1.5 text-muted">·</span>
                      <span className="font-semibold text-muted">
                        {r.dogName ?? "—"}
                      </span>
                    </span>
                    <span className="rounded-lg border border-line bg-surface px-2 py-0.5 text-xs font-bold text-muted">
                      {levelLabel(r.experienceLevel)}
                    </span>
                    <button
                      onClick={() => onDeleteTeam(r._id)}
                      aria-label="הסר מתחרה"
                      className="rounded-lg p-1.5 text-danger hover:bg-danger/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}

        {/* Dates → rounds */}
        <h2 className="ds-label mb-3">מועדים וסבבים</h2>
        <div className="space-y-4">
          {league.dates.map((d) => (
            <div key={d._id} className="ds-card p-5">
              <div className="mb-3 flex items-center gap-2 font-extrabold">
                <CalendarDays className="h-5 w-5 text-accent" />
                {d.label?.trim() ||
                  new Date(d.date).toLocaleDateString("he-IL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {Array.from({ length: d.roundsCount }, (_, k) => k + 1).map(
                  (roundIndex) => {
                    const ev = roundEvent(d._id, roundIndex);
                    const key = `${d._id}:${roundIndex}`;
                    return (
                      <div
                        key={roundIndex}
                        className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-4 py-3"
                      >
                        <span className="text-sm font-bold">סבב {roundIndex}</span>
                        <div className="flex items-center gap-2">
                          {ev ? (
                            <>
                              <Link
                                href={`/c/${ev.slug}/live`}
                                className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:border-accent/40 hover:text-ink"
                              >
                                <Trophy className="ml-1 inline h-3.5 w-3.5" />
                                לייב
                              </Link>
                              {isManager && (
                                <Link
                                  href={`/c/${ev.slug}/judge`}
                                  className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted hover:border-accent/40 hover:text-ink"
                                >
                                  <Gavel className="ml-1 inline h-3.5 w-3.5" />
                                  שיפוט
                                </Link>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-muted">טרם נוצר</span>
                          )}
                          {isManager && (
                            <button
                              onClick={() => onGenerate(d._id, roundIndex)}
                              disabled={busy === key}
                              className="rounded-xl bg-lime px-3 py-1.5 text-xs font-black text-lime-ink shadow-glow hover:brightness-105 disabled:opacity-50"
                            >
                              <RefreshCw
                                className={`ml-1 inline h-3.5 w-3.5 ${
                                  busy === key ? "animate-spin" : ""
                                }`}
                              />
                              {ev ? "הפק מחדש" : "צור סבב"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
