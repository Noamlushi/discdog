# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

J'GAMES — a real-time web platform for running, judging, and spectating dog-frisbee
competitions.

The agreed app flow (owner-defined, 2026-06-13; ownership model added 2026-07-15):
1. **Admin (owner) creates a competition** → it gets a unique shareable URL
   (`/c/:slug`) and can be assigned to one or more **Organizers**.
2. **Organizers run their competition** from that URL — everything below, scoped
   to them by ownership (import roster, generate schedule, judge). The public can
   open the same URL to reach the live dashboard + leaderboard.
3. **Import roster** → uploads Excel/CSV from Google Forms export
4. **Generate schedule** → engine produces run order; can be reordered manually
5. From there, two parallel entry points:
   - **Judge view** (`/judge`) — tap-based scoring UI per discipline
   - **Live/spectator view** (`/live`) — real-time dashboard (who's up, scores, timers)

The admin/schedule/judge split is intentional — do not merge these into a single flow.

**Distance League** (added 2026-07-15): a league (`/l/:slug`) runs the same Distance
judging spread over several organizer-chosen **dates (מועדים)**, each with N **rounds
(סבבים, default 2)**. Each round is realized as an **ordinary `Event`** (tagged
`leagueId`/`leagueDateId`/`roundIndex`) so the whole scheduler/judge/scoring pipeline
is reused unchanged. The league has its own dashboard + standings; the winner is
**best-of-N rounds** (default) or **sum of all rounds** (organizer-configurable), so a
team that skips a date is still ranked on its best runs. Roster is imported **once** at
the league level and cloned onto each round Event.

**Auth (§9.3)**: real JWT login now exists. Roles are `Admin | Organizer | Judge | Player`.
Admin creates competitions/leagues and provisions Organizers; Organizers manage the
competitions/leagues they own. Public read endpoints (events/leagues lists + details,
leaderboards, heats read, standings) need no auth.

`SPEC.MD` is the canonical product/technical specification. Source files reference its
sections by number (e.g. `// §5.2`, `§4.4`). **When implementing a feature, read the
relevant SPEC.MD section first** — it defines the data model, scoring rules, scheduling
constraints, and discipline-specific behavior that the code is built against.

## Layout

Two independent packages, no workspace tooling — install and run each separately:

- `server/` — Express + Mongoose + Socket.io API (TypeScript, CommonJS, port 4000)
- `client/` — Next.js 15 App Router + React 19 + Tailwind v4 + Serwist PWA (port 3000)

## Commands

Start MongoDB first (required by the server):

```bash
# On this machine — MongoDB Community installed via Homebrew (no Docker):
brew services start mongodb-community

# Original docker-compose approach (if Docker Desktop is available):
# docker compose up -d
```

Note: `server/.env` uses `MONGODB_URI=mongodb://localhost:27017/jgames` (no auth) because
MongoDB Community runs without authentication locally. The `.env.example` has credentials
for the docker-compose setup — do not restore them for local dev.

Server (`cd server`, copy `.env.example` → `.env` first):

```bash
npm run dev         # nodemon + tsx, watches src/
npm run build       # tsc → dist/
npm start           # node dist/index.js
npm run typecheck   # tsc --noEmit
```

Client (`cd client`, copy `.env.example` → `.env.local`):

```bash
npm run dev         # next dev
npm run build       # next build (also compiles app/sw.ts → public/sw.js via Serwist)
npm run lint        # next lint (eslint)
npm run typecheck   # tsc --noEmit
npm run icons       # regenerate PWA icons from scripts/generate-icons.mjs
```

There is **no test framework wired up** in either package yet.

## Server architecture

- `src/index.ts` — bootstraps: connects Mongo, creates the Express app, attaches Socket.io
  to the **same HTTP server** (REST + WebSocket share one origin, §2.1), and exposes `io`
  via `app.set("io", io)` so route handlers can emit real-time events.
- `src/app.ts` — Express wiring: CORS, JSON, `/health`, all routers under `/api`, then the
  `notFound` + `errorHandler` chain (must stay last).
- `src/routes/` — one router file per resource, aggregated in `routes/index.ts`. Each
  protected route is composed as `authenticate → requireRole(...) → handler`.
- `src/sockets/events.ts` — **single source of truth** for socket event names
  (`SERVER_EVENTS`, `CLIENT_EVENTS`) and the `eventRoom(eventId)` helper. Clients join a
  per-event room (`event:<id>`) so score broadcasts are scoped to one competition.
- `src/models/` — Mongoose schemas mirroring SPEC §4, re-exported from `models/index.ts`.
  Enums (`UserRole`, `EventStatus`, `ExperienceLevel`, `MatchStatus`) live in
  `src/types/index.ts` and are reused for schema `enum` validation — add new enum values
  there, not inline in schemas.
- `src/config/env.ts` — central typed env access. `MONGODB_URI` and `JWT_SECRET` are
  **required** (throws on boot if missing); others have defaults.

## Client architecture

- **Entry flow:** `app/page.tsx` is the public landing (lists standalone competitions +
  Distance leagues, plus "create competition"/"create league"/"ניהול"). Picking a
  competition opens its shareable **portal `app/c/[slug]/page.tsx`** — details + public
  choices **דשבורד** and **טבלת תוצאות**; managers (Admin/Organizer) additionally see
  **שיפוט** (`/judge?eventId=`) and the admin detail. The legacy `app/events/[id]/page.tsx`
  hub redirects to `/c/:slug`. Leagues open **`app/l/[slug]/page.tsx`** (per-date round cards
  + roster import + round generation for managers).
- **Scoped dashboards (no picker / no cross-browsing):** each competition's dashboards live
  under the route group `app/c/[slug]/(dash)/` — `live`, `leaderboard`, `schedule` — wrapped
  by `(dash)/layout.tsx`, which resolves the event by slug and renders
  `<LiveSessionProvider fixedEventId>` + `components/live/ScopedLiveShell` (title + bottom
  nav, **no competition `<select>`**). The three view **implementations** live in
  `components/live/{LiveNowView,LeaderboardView,ScheduleView}.tsx`; the scoped page files just
  re-export them. Leagues mirror this with `app/l/[slug]/(dash)/` → `standings` + `live` (the
  live tab reuses `LiveNowView`, locked to the league's active round). There is **no generic
  `/live` route** — it was removed (owner decision 2026-07-15); every dashboard belongs to
  exactly one competition/league. `LiveSessionContext` is locked-only: `LiveSessionProvider`
  requires `fixedEventId` and exposes `{ eventId, event, loading, error }` (no picker/state).
- **Auth:** `context/AuthContext.tsx` (token in localStorage via `lib/api` `getToken/setToken`)
  wraps the app in `app/layout.tsx`. `/login` authenticates; `components/auth/RequireAuth.tsx`
  (`RequireManager`) guards the admin + judge shells. `lib/api.ts` `request()`/`upload()`
  attach the `Authorization: Bearer` header automatically.
- App Router with role-based route groups: `app/admin`, `app/judge`, `app/live`, each with
  its own `layout.tsx`. The admin (events/import/schedule), judge (scoring/review), and
  live (spectator) flows are built — see Implementation status for what's still open.
- `context/SocketContext.tsx` — wraps the whole app in `app/layout.tsx`. One Socket.io
  client per provider lifetime; consume via `useSocket()` (`{ socket, isConnected }`).
- PWA (§6.1) — `app/sw.ts` is the Serwist service worker source, compiled to
  `public/sw.js` at build time (config in `next.config.ts`; disabled in dev). This backs
  the offline-judging / Background-Sync requirement; `public/sw.js*` is gitignored.
- Tailwind v4 (PostCSS-based, no JS config file). Custom design tokens like `bg-live`,
  `text-live-fg`, `shadow-soft` come from the theme in `app/globals.css` — check there
  before adding new color/utility classes.

## Implementation status (important)

### Built and working

- **Auth & ownership (§9.3)** — real JWT. `POST /api/auth/login`, `GET /api/auth/me`,
  `POST /api/auth/register` (Admin), `GET /api/auth/organizers`. `middleware/auth.ts`
  verifies the Bearer token → `req.user`; `requireRole` gates by role;
  `middleware/requireManager.ts` (`requireEventManager`/`requireLeagueManager`) gates
  event/league writes to the Admin or an assigned Organizer. Bootstrap the first admin
  with `npm run seed:admin` (reads `ADMIN_EMAIL`/`ADMIN_PASSWORD`/`ADMIN_NAME`). Client:
  `/login`, `AuthContext`, `RequireAuth`/`RequireManager`.
- **Event management + portal** — `POST /api/events` (Admin) creates an event with a unique
  `slug`, `ownerId`, and `organizerIds`. `GET /api/events/slug/:slug` resolves the portal;
  `PATCH /api/events/:id/organizers` (Admin) assigns organizers; `GET /api/events` returns
  standalone events (or `?leagueId=` for a league's rounds). Client: `app/admin/events/`,
  `app/admin/events/new/`, `app/admin/events/[id]/`, and the public portal `app/c/[slug]/`.
- **Roster import** — `POST /api/events/import` (multer + SheetJS) fully implemented in
  `services/roster-import.service.ts`. Client: `app/admin/import/` with drag-drop upload
  and import summary.
- **Schedule generation** — `POST /api/schedule/generate` runs the full §7 engine.
  `PATCH /api/schedule/swap` swaps two heats. `PATCH /api/schedule/reorder` reassigns
  scheduled times for an ordered list of heats within a pitch (used by drag-and-drop).
  Scheduler enforces `minRestTimeMinutes` for both dogs **and** players (previously only
  dogs got rest; same-player back-to-back runs are now blocked by the engine). Client:
  `app/admin/schedule/` with generate button, per-pitch tabs, HTML5 drag-and-drop row
  reordering, conflict highlighting (rows in amber when same player/dog appears within the
  rest window), and a player modal (click any player name → all their heats across both
  pitches, with gap times and conflict indicators).
- **Heats read** — `GET /api/heats?eventId=&pitch=&status=` returns heats with populated
  player/dog names (used by the schedule and live screens).
- **Heat status** — `PUT /api/heats/:id/status` updates status and broadcasts
  `match_status_changed` via Socket.io.
- **Scoring engine + routes** — all 10 disciplines have their own scorer in
  `src/scoring/*` (dispatched by `categoryId`). `POST /api/scoring/action` and
  `/undo` append/remove an `ActionLog` entry, recompute via
  `services/scoring.service.ts`, persist `finalScore`, and broadcast
  `live_score_updated` (+ `freestyle_sync` for Freestyle). `GET /api/scoring/:matchId`
  returns the recomputed score, breakdown, and the throw-by-throw timeline.
  Distance/Ice Drop count the **best 5 throws** (not the first 5).
- **Judge scoring UI** (`app/judge/`) — full On-Deck → Scoring → review flow.
  `components/judge/scorers/*` has one tap-scorer per scorer family (zones, count,
  area, agility, crisscross, timed, panel) dispatched by discipline;
  `JudgeSessionContext` holds the active heat + run start; `SmartTimer` is an
  epoch-derived resilient clock. Finishing a heat lands on the review page.
- **Per-heat stats + review** — every scorer reports `catches`/`misses` in its
  breakdown; misses are logged uniformly as `{ miss: true }` via the shared
  `MissButton`. `app/judge/log` is the post-run summary (catch/miss/rate cards +
  Hebrew throw timeline from `lib/actionLabels.ts`). Freestyle is a deep 4-panel
  rubric (dog/player/team elements 0–2.5, team counts top-4 of 7, execution =
  catches÷throws×10); its rubric metadata lives in `lib/freestyle.ts` and the
  review renders a Freestyle-specific element breakdown.

- **Leaderboards** — `GET /api/leaderboards/:eventId` ranks completed heats per
  discipline/level (standard competition ranking, direction-aware: points desc / time
  asc). Client: `app/live/leaderboard/`.
- **Live dashboard** (`app/live/`) — public spectator views: `page.tsx` (live now),
  `schedule/page.tsx`, `leaderboard/page.tsx`, driven by `liveStartedAt` countdown and
  the live-heats socket channel.
- **Distance League** — `models/League.ts` (dates → rounds, `scoring.mode` best-of-N/sum).
  Routes under `/api/leagues`: create (Admin), list/detail/slug/standings (public), `import`
  (manager, master roster, Distance-only), `rounds/generate` (manager). Each round is an
  ordinary `Event` tagged `leagueId`/`leagueDateId`/`roundIndex`; `services/league-round.service.ts`
  clones the master roster onto the round Event and calls the existing `generateSchedule`.
  `services/league-standings.service.ts` aggregates completed Distance heats per team with
  best-of-N (default) or sum. `GET /api/leagues/:id/export` (manager) builds the league
  workbook in `services/league-export.service.ts` — a summary sheet with the standings
  matrix plus one sheet per round with a row per competitor (name, dog, then each throw
  side by side with its points, the heat score, and catch/miss stats). Client:
  `app/admin/leagues/new/`, portal `app/l/[slug]/`, and `app/l/[slug]/standings/`.

### Still stubbed / not yet built

- **Auth hardening** — real JWT auth is wired (see "Auth & ownership" above), but a few
  gaps remain by design: there is **no organizer self-registration UI** (Admin creates
  accounts via `POST /api/auth/register`), match-scoped writes (`scoring/*`,
  `heats/:id/status`, `schedule/swap`+`reorder`) are role-gated but not per-event
  ownership-checked (only the `eventId`-scoped writes go through `requireManager`), and the
  socket channel is unauthenticated (public read). Password reset / token refresh are absent.
- **Public per-competitor results page** — a screen where a team looks itself up and sees
  all its heats with the review stats. The `GET /api/scoring/:matchId` endpoint already
  supports it; only the UI is missing.
- **Freestyle safety deductions / fall-injury clock stop** — per the rulebook these are
  handled manually at the judging tent; no UI exists for entering a deduction or stopping
  the clock on a fall.

## Conventions

- Cite the SPEC section in a comment when implementing spec-driven logic (matches existing
  style, e.g. `// §3.3`).
- Keep socket event names in `sockets/events.ts` and reference the constants — never inline
  string literals like `"live_score_updated"`.
- Server is CommonJS + strict TS; use Node `node:` import prefixes (e.g. `node:http`).
