# J'GAMES — UI Structure Reference (for design)

A real-time web platform for running, judging, and spectating **dog-frisbee
competitions**. This document describes how every screen is composed, so a
designer (or design AI) can restyle the pages while keeping the structure and
information hierarchy intact.

---

## Global conventions

- **Direction & language:** RTL, Hebrew UI text throughout. All labels below are
  shown in Hebrew in the product; English is given here only to explain intent.
- **Platforms / breakpoints:** phone → tablet → desktop → venue TV. The judge
  surface is phone/tablet-first with oversized tap targets; the live dashboard
  scales all the way up to a big screen.
- **Two visual worlds (intentional):**
  - **Warm "sunset" theme** — public-facing surfaces (landing, competition/league
    portals, live dashboards, login). Cream background, orange→coral→gold
    gradients, soft glow shadows, playful paw-print motifs, rounded 2xl/3xl cards.
  - **Cool "utility" theme** — admin + judge working surfaces. White cards, slate
    borders, electric-blue primary (`nav`), neon-green live accent (`live`).
- **Design tokens (from `globals.css`):**
  - Colors: `sunset #ff6b35`, `coral #ff4d6d`, `tangerine #ff8c42`,
    `sunbeam #ffc233`, `cream #fff7ed`, `cocoa #3a2417` (warm text);
    `nav #1b6ef3` (blue primary), `live #39ff14` (neon-green live accent).
  - Radius: `xl 1rem`, `2xl 1.5rem`, `3xl 2rem`.
  - Shadows: `shadow-soft` (subtle card lift), `shadow-glow` (warm orange glow
    under hero cards).
  - Tap target: `tap = 4rem` (used as `h-tap` for judge buttons — fat-finger safe).
  - Font: Inter.
  - Animations: `score-pop` (score scales up briefly on change), `paw-drift`
    (slow floating paw motif). Both respect `prefers-reduced-motion`.
- **Common building blocks:** breadcrumb nav, icon-in-rounded-square avatars,
  status pills (Planning/Live/Completed), stat cards (label + big number),
  empty states (dashed border + icon + hint), medal emojis for ranks 1–3 (🥇🥈🥉).
- **Roles:** Admin, Organizer, Judge, Player. "Manager" = Admin or Organizer;
  manager-only controls are conditionally rendered on otherwise-public screens.

---

## 1. Landing / Home — `/`  (public, sunset theme)

The platform's front door. Lists all competitions and leagues.

- **Hero banner:** full-width rounded-3xl orange→coral gradient card with drifting
  paw motifs. Contains: small "🐾 J'GAMES" pill, large title, subtitle, and a row
  of 3 action buttons — **Create Competition** (solid white), **Create League**,
  **Management/ניהול** (translucent).
- **Competitions section:** heading with trophy icon, then a responsive 2-column
  grid of cards. Each card = trophy avatar + name + (date · number of pitches) +
  status pill + chevron. Clicking opens that competition's portal.
- **Leagues section** (only if leagues exist): same card pattern, tangerine→coral
  avatar, subtitle shows "N dates · best-of-N / sum".
- **Empty state:** dashed rounded box, trophy icon, "no competitions yet" + hint.
- **States:** loading text, error banner (red).

---

## 2. Competition Portal — `/c/:slug`  (public, sunset theme)

The shareable single-URL entry point for one competition. Max-width ~3xl, centered.

- **Breadcrumb:** Competitions › {name}.
- **Title block:** trophy avatar + competition name + status label.
- **Stats grid** (2 cols mobile / 4 desktop): Date, Hours (start–end), Pitches,
  Min rest (minutes). Each is a small white stat card with icon + label + value.
- **Time-window banner:** soft sunset-tinted pill showing total duration.
- **"Enter competition" choice cards** (public, 2-col grid): tall cards with
  gradient icon tile, title, description, and "Enter →":
  - **Dashboard** (`/c/:slug/live`) — live: who's on, scores, timers.
  - **Leaderboard** (`/c/:slug/leaderboard`) — ranking by discipline & level.
- **"Management (organizers)" section** — *managers only*, another 2-col grid:
  - **Judging** (`/judge?eventId=`) — tap-based scoring per discipline.
  - **Manage competition** (`/admin/events/:id`) — import, schedule, run order.

---

## 3. Scoped Live Dashboards — `/c/:slug/(live | leaderboard | schedule)`

All three share a **scoped shell** (`ScopedLiveShell`, sunset theme) — there is
**no competition picker**; the dashboard is locked to one competition.

- **Sticky top bar:** paw avatar + competition title (+ optional subtitle) on one
  side; a **live connection pill** ("משדר / מתחבר…" — broadcasting/connecting,
  animated dot) on the other.
- **Bottom fixed nav:** equal-width tabs with icon + label; active tab gets a
  colored top bar and sunset text. Tabs = Live / Leaderboard / Schedule.
- **Main content area** = one of the three views below.

### 3a. Live Now view (`/c/:slug/live`)
A "control-room" dashboard, driven by real-time socket updates.
- **Hero pitch card** (spans 2 cols on desktop): big orange gradient card with
  drifting paws. Shows pitch number, a "LIVE / משחק עכשיו" pulsing badge (or
  "free"), discipline · level, competitor name (huge) + dog name, and the
  **giant running score** (pops on each change). Below: a **run clock** with a
  depleting progress bar (turns urgent/pulsing under 15s). A "next up" strip at
  the bottom.
- **Right rail (stacks on mobile):**
  - **Progress tile** — radial conic-gradient gauge showing % of heats completed
    + "X / Y heats done".
  - **Mini pitch tiles** — compact live card per other pitch (top gradient bar,
    pitch, live/free badge, competitor + dog, score, countdown, next-up).
- **Leaders rail** — horizontal scroll of small cards: top team per
  discipline+level (🥇, discipline·level, player name, big score).

### 3b. Leaderboard view (`/c/:slug/leaderboard`)
- Title with amber trophy.
- One **section per discipline** (busiest first): discipline name heading, then a
  2-col grid split by level (Advanced / Beginner). Each level = an ordered list of
  rows: rank (medal emoji for top 3) + player (· dog) + score (mono, blue).
  Refreshes as heats complete. Empty state while competition in progress.

### 3c. Schedule view (`/c/:slug/schedule`)
- Title + **pitch tab buttons**.
- **Run order list** for the selected pitch: numbered rows, each = player · dog,
  discipline · level · time, and a **status badge** (Pending / On-Deck / Live /
  Completed). Live rows are highlighted (green ring). Finals placeholders render
  as dashed "final — awaiting qualifiers" rows.

---

## 4. Admin Dashboard — `/admin`  (manager-only, utility theme)

Wrapped by an **admin shell**: left sidebar (desktop only) with "J'GAMES Admin"
title and nav links (Dashboard, Events, New League, Schedule, Import, Settings);
main content on the right. Guarded by `RequireManager`.

- **Dashboard page:** title + subtitle, then a 2-col grid of navigation cards
  (icon tile + title + description + "Enter →"): Competitions, Import competitors,
  Run order/schedule, Settings.

---

## 5. Events list — `/admin/events`  (manager, utility theme)

- Header row: title + subtitle on the left, **"New competition"** primary button
  (blue, plus icon) on the right.
- **List** of event rows: trophy avatar + name + (date · pitches) + status pill.
  Each links to the event detail.
- Loading / empty states.

## 6. New Competition — `/admin/events/new`  (manager, utility theme)

Centered single-column form (max-w-xl). Header explains next steps (import →
schedule). Fields, each with icon + label:
- Competition name (text)
- Date (date picker)
- Start time / End time (2-col row of time inputs)
- Number of pitches / Min rest minutes (2-col row of number inputs)
- Error banner (red) if creation fails.
- Full-width primary submit button ("Create competition →").
On success → redirects to the event detail page.

## 7. Event Detail — `/admin/events/:id`  (manager, utility theme)

- Breadcrumb: Competitions › {name}.
- Title block: trophy avatar + name + status.
- **Stats grid** (Date, Hours, Pitches, Min rest) — same stat-card pattern.
- **Duration banner** (blue-tinted).
- **"Next steps" action cards** (stacked): icon + title + description + chevron:
  - Import roster (`/admin/import?eventId=`).
  - Generate schedule (`/admin/schedule?eventId=`) — shown **disabled** with a
    reason ("import roster first") until a roster exists.

## 8. Roster Import — `/admin/import`  (manager, utility theme)

Centered (max-w-2xl). Breadcrumb + header (explains required columns: full name,
dog name, phone, disciplines).
- **Form state:**
  - Competition selector (`<select>`).
  - **Drag-and-drop file dropzone** (dashed border, upload icon, "drag file here /
    click to choose — XLSX, XLS, CSV"). When a file is chosen it turns green with
    a spreadsheet icon, filename, size, "click to replace".
  - Error banner. Full-width primary submit ("Import list →", disabled until file
    + event chosen).
- **Result state** (after import): green success banner, a 4-up **stats grid**
  (rows processed, players added, dogs added, registrations added), optional
  "N duplicates skipped" note, amber **warning cards** (e.g. unknown disciplines),
  and two actions: "Import another" (outline) + "Continue to schedule →" (primary).

## 9. Schedule / Run Order — `/admin/schedule`  (manager, utility theme)

The most data-dense admin screen. Breadcrumb + header.
- **Toolbar:** competition selector, **Generate / Regenerate** button (spinning
  refresh icon while running), and **Export to Excel** button (outline) once heats
  exist.
- **Report banner** after generating: green (fits window) or amber (overflows) —
  shows heats created (+ finals), makespan vs. window minutes and utilisation %.
  Warning rows below.
- **Pitch tabs** (if >1 pitch): each tab shows pitch number + a count badge.
- **Conflict summary banner** (amber): "N runs with a rest problem … marked in
  yellow."
- **Schedule table** (the heart of the screen): draggable rows (HTML5
  drag-and-drop to reorder within a pitch). Columns: drag handle, #, time (mono),
  discipline, level, **player (clickable button)**, dog, status pill. Conflicting
  rows are amber-tinted; the drop target shows a blue top border; finals
  placeholders are dimmed.
- **Player modal** (opens on clicking a player name): dialog listing all that
  player's heats across both pitches — time, pitch badge, discipline · level, dog,
  a conflict warning icon, and the **gap in minutes** from the previous run
  (amber when it violates the rest window). Used to validate scheduling manually.
- Empty state ("no run order yet — press Generate").

---

## 10. Judge — On-Deck — `/judge`  (manager/judge, utility theme)

Wrapped by the **judge shell**: mobile-first, `pb` for a **fixed bottom nav** with
3 oversized tabs (On-Deck / Scoring / Log). Guarded by `RequireAuth`
(Admin/Organizer/Judge).

- Header: "Next up" + instruction line.
- **Competition context:** if arrived via deep link, shows the competition locked
  as a blue banner with a "switch" link; otherwise a large `<select>`.
- **Pitch picker:** row of big square pitch buttons (selected = blue). (Skipped
  for single-pitch events like league rounds.)
- **On-Deck card:** discipline · level pill, "up next / running now" label,
  competitor name (large, user icon) + dog (dog icon), and a big neon-green
  **"Start judging"** button (`h-tap`) that flips the heat to Live and opens
  scoring.
- Empty ("no heats waiting on pitch N") / error / loading states.

## 11. Judge — Live Scoring — `/judge/scoring`  (utility theme)

Discipline-specific tap scoring. Real-time via sockets.
- **Header:** competitor + (dog · discipline · level) on one side; pitch badge on
  the other.
- **Timer + score card:** a resilient `SmartTimer` (epoch-derived, counts up or
  down per discipline) on one side; the **live running score** (huge mono number)
  on the other.
- **Discipline scorer** (the main control area) — swapped by discipline family:
  - **Distance / Ice Drop:** two "bonus" toggle buttons (+0.5) that arm before a
    tap, then a stacked list of big **zone buttons** ("Zone N" + points), plus a
    **Miss** button. All targets are `h-tap` sized with active-press feedback.
  - Other families: zones, count, area, agility, crisscross, timed, panel — each
    is a tap-scorer with the same fat-finger button language.
- **Finish heat** button (blue, `h-tap`) — hidden for Freestyle (which finishes
  per-judge inside its 4-panel scorer). Finishing → the review/log page.
- **Floating Undo FAB** (bottom corner) — removes the last logged action.
- Error banner; "no active heat" fallback with a link back to On-Deck.

## 12. Judge — Review / Log — `/judge/log`  (utility theme)

Post-run summary shown to the team.
- Header: "Heat summary" + a refresh button.
- **Competitor card:** player + (dog · discipline).
- **Stat cards** (2/4-up): Score, Catches (green), Misses (red), Success rate %.
- **Freestyle is special** (staged): while the 4-judge panel is still scoring,
  each judge sees only **their own panel card** + a **"waiting on N judges"** list;
  once all four finish, the full **/40 rubric** appears — one card per panel
  (dog/player/team, elements out of 2.5, counted elements dotted, subtotal /10)
  plus an **execution card** (catches ÷ throws → /10).
- **Throw-by-throw timeline:** ordered list of every action — index, colored dot
  (catch = green / miss = red / neutral), Hebrew action label, timestamp (mono).
- **"Next competitor" button** (blue, `h-tap`) → back to On-Deck.

---

## 13. League Portal — `/l/:slug`  (public + manager, sunset theme)

A Distance league spread over several dates, each with N rounds. Max-w-3xl.
- Breadcrumb + title block (list-ordered avatar, name, "N dates · best-of-N / sum").
- **Dashboard entry cards** (2-col): **League standings** (public) and, for
  managers, an **Import roster** card (file upload — imported once, cloned to each
  round).
- **Message banner** (import/generate feedback).
- **Roster management section** *(managers only)*: header with count, an
  **add-team form** (player name, dog name, level select, add button), and an
  **ordered roster list** (index badge, player · dog, level pill, delete button).
- **Dates → rounds:** one card per date (calendar icon + date label). Inside, a
  2-col grid of **round rows** ("Round K"): if the round Event exists → **Live**
  link (+ **Judging** link for managers); managers get a **Generate / Regenerate**
  round button. Rounds not yet created show "not yet created".

## 14. League Dashboards — `/l/:slug/(standings | live)`

Uses the same scoped shell as the competition dashboards (locked, no picker).
- **Standings** (`/l/:slug/standings`): "N rounds total" subtitle, then one
  **section per level** (Advanced/Beginner). Each = a table: rank (medal for top
  3) + player/dog + **per-round score chips** + cumulative total (big sunset
  number). Auto-refreshes every 15s.
- **Live** (`/l/:slug/live`): reuses the competition **Live Now** view, locked to
  the league's currently active round.

---

## 15. Login — `/login`  (public, sunset theme)

Centered card on a cream gradient. Paw avatar, "System login" title + subtitle,
then a rounded-3xl white form: email + password inputs (LTR), error banner, and a
gradient **"Log in"** button. "Back to home" link below. Only Admin/Organizer/
Judge accounts log in; public surfaces need no auth.

---

## Screen inventory (quick map)

| Screen | Route | Audience | Theme |
|---|---|---|---|
| Landing | `/` | Public | Sunset |
| Competition portal | `/c/:slug` | Public (+manager extras) | Sunset |
| Live now | `/c/:slug/live` | Public | Sunset |
| Leaderboard | `/c/:slug/leaderboard` | Public | Sunset |
| Public schedule | `/c/:slug/schedule` | Public | Sunset |
| Admin dashboard | `/admin` | Manager | Utility |
| Events list | `/admin/events` | Manager | Utility |
| New competition | `/admin/events/new` | Manager | Utility |
| Event detail | `/admin/events/:id` | Manager | Utility |
| Roster import | `/admin/import` | Manager | Utility |
| Schedule / run order | `/admin/schedule` | Manager | Utility |
| Judge on-deck | `/judge` | Manager/Judge | Utility |
| Judge scoring | `/judge/scoring` | Manager/Judge | Utility |
| Judge review/log | `/judge/log` | Manager/Judge | Utility |
| League portal | `/l/:slug` | Public (+manager extras) | Sunset |
| League standings | `/l/:slug/standings` | Public | Sunset |
| League live | `/l/:slug/live` | Public | Sunset |
| Login | `/login` | Public | Sunset |
</content>
</invoke>
