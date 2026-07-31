# J'GAMES — Dog Frisbee Competition Platform

**Technical Specification**
Version 1.0 | June 2025

---

## 1. Overview

The J'Games Dog Frisbee App is a responsive web application designed for the real-time management, operation, and judging of dog frisbee competitions in J'Games format. The system is built to fully replace manual record-keeping and error-prone calculations by automating scheduling, providing interactive gamified judging interfaces on tablets, and streaming live results to spectators.

### 1.1 Core Features

- **User Authentication & Roles** — Role-based access control for Admins, Judges, and the Public (spectators/players).
- **Scheduling Engine** — Algorithmic schedule generation that respects minimum dog rest times, judge availability windows, and reserved slots for finals.
- **Gamified Judging UI** — Tap-only judging screens tailored per discipline, including interactive field maps (e.g., Criss-Cross), stopwatches, and a multi-judge panel for the Freestyle event.
- **Live Dashboard** — Real-time competition dashboard showing audiences who is next on deck and auto-updating leaderboards.
- **Data Import** — Competitor and dog roster import via Excel/CSV file upload.

### 1.2 Tech Stack

- **Frontend & Backend:** Next.js (App Router) or React.js + Node.js — optimised for mobile, tablet, and desktop.
- **Database:** MongoDB (NoSQL) — ideal for storing variable scoring objects across diverse discipline types.
- **Real-Time:** WebSockets via Socket.io — instant audience score updates without page refresh.
- **Styling:** TailwindCSS — fast, clean, and fully responsive design system.

---

## 2. Architecture

### 2.1 High-Level Architecture

- **Client-Server Model:** The browser communicates with the Node.js server via standard REST API calls for management operations, and via WebSockets for real-time actions (e.g., submitting scores from a tablet).
- **Database:** Data is stored in a centralised cloud database (MongoDB Atlas), providing maximum flexibility for managing varying discipline rules.
- **Offline Mode:** PWA (Progressive Web App) architecture with Service Workers. Judge tablet data is stored locally in IndexedDB during network loss and pushed to the server when connectivity is restored via Background Sync.

### 2.2 Application Layers

- **Presentation Layer:** Admin dashboard for file uploads, interactive judging screens for tablets (with Undo mechanism), and a public audience portal.
- **API & Logic Layer:** Schedule generation engine (conflict and rest-time validation), and real-time judging session management.
- **Data Access Layer:** Mongoose schemas for all system entities in MongoDB.

---

## 3. Functional Requirements

### 3.1 Authentication & Roles

- **Admin** — Full access. Creates competitions and Distance leagues (each gets a unique
  shareable URL), provisions Organizer accounts, and assigns them to competitions/leagues.
- **Organizer** — Runs the competitions/leagues they've been assigned to (ownership-scoped):
  roster upload, schedule generation, judging, league round generation. Cannot touch
  competitions they don't own.
- **Judge** — Login and select an assigned judging field.
- **Public** — Open access (no login required) to view leaderboards, schedules, and league
  standings via the competition/league URL.

Access model (§9.3): JWT login for Admin/Organizer/Judge. Ownership is enforced by
`ownerId` + `organizerIds` on both `Event` and `League`; public read endpoints are open.

### 3.2 Admin & Scheduling

- **Event Wizard:** The admin defines competition hours, number of fields, minimum dog rest time, break windows, and judge availability blocks.
- **Sanity Check:** Before running the algorithm, the system calculates a 'theoretical minimum duration' and warns if the entered time frame is too short.
- **Manual Overrides:** Drag-and-drop schedule editing with colour-coded conflict alerts (red = conflict, green = valid).

### 3.3 Judge Interface

- **On-Deck Screen:** Waiting screen showing the next competitor to take the field, with a 'Start Run' button.
- **Live Scoring & Undo:** Discipline-specific scoring UI. A floating Undo button removes the last action without losing focus.
- **Freestyle Sync:** 4 tablets synchronise in real time to produce a combined final score out of 40 points. The run timer adapts by level: 90 seconds for Beginners, 120 seconds for Advanced.
- **Dog Height Alerts:** Automatic alerts prompt the judge to lower the bar height for dogs under 35 cm in the Frisbee Agility discipline.

### 3.4 Public Live Dashboard

- **No Pull-to-Refresh:** Screens self-update in real time without any user action.
- **Live Now:** Displays what is currently happening on each field and who is warming up.
- **Leaderboards:** Live results table with a clear split between Beginner and Advanced levels (e.g., Distance event).

---

## 4. Data Model & Database Schema (MongoDB)

All data is managed via Mongoose under the following schemas:

### 4.1 User Schema

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | Primary key |
| `name` | String | Full name of the user |
| `phone_number` | String | Contact number |
| `role` | String (enum) | Admin \| Organizer \| Judge \| Player — critical for preventing judge-competitor conflicts |
| `email` | String | Login identifier (Admin/Organizer/Judge only; unique, sparse) |
| `passwordHash` | String | bcrypt hash; absent for roster-imported Players (§9.3) |

### 4.2 Dog Schema

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | Primary key |
| `ownerId` | ObjectId (Ref: User) | Reference to the owning player |
| `name` | String | Dog's name |
| `dob` | Date | Date of birth — used to enforce minimum age: 12 months general, 15 months for Freestyle |
| `isUnder35cm` | Boolean | Flag for bar-height reduction in Frisbee Agility |
| `medical_status.rabies` | Date | Date of rabies vaccination |
| `medical_status.brucella` | Date | Date of brucella test |

### 4.3 Event Schema

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | Primary key |
| `name` | String | Event title |
| `slug` | String | Unique shareable URL segment (`/c/:slug`) |
| `ownerId` | ObjectId (Ref: User) | The Admin who created it |
| `organizerIds` | Array&lt;ObjectId&gt; | Organizers assigned to manage it (§3.1) |
| `estimatedStartTime` | Date | Planned start time |
| `estimatedEndTime` | Date | Planned end time |
| `minRestTimeMinutes` | Number | Minimum required rest time between a dog's runs (minutes) |
| `calculatedMinDuration` | Number | Theoretical minimum duration computed by the scheduler |
| `activePitches` | Number | Number of concurrent judging fields |
| `status` | String (enum) | Planning \| Live \| Completed |
| `leagueId` | ObjectId (Ref: League) | Set when this Event is one round of a league |
| `leagueDateId` | ObjectId | The league date this round belongs to |
| `roundIndex` | Number | 1-based round number within its league date |

### 4.4 Match / Heat Schema

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | Primary key |
| `eventId` | ObjectId (Ref: Event) | Parent event reference |
| `categoryId` | String | e.g., Distance, Freestyle, CrissCross |
| `experienceLevel` | String (enum) | Beginner \| Advanced |
| `pitchNumber` | Number | Assigned judging field number |
| `scheduledTime` | Date | Planned start time of the heat |
| `team.playerId` | ObjectId | Reference to the competing player |
| `team.dogId` | ObjectId | Reference to the competing dog |
| `judgeIds` | Array&lt;ObjectId&gt; | Assigned judge(s) for this heat |
| `status` | String (enum) | Pending \| On-Deck \| Live \| Completed |
| `finalScore` | Mixed (Number\|String) | Final numeric score or time string |

### 4.5 Action Log Schema (Undo Support)

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | Primary key |
| `matchId` | ObjectId (Ref: Match) | Reference to the active heat |
| `timestamp` | String | Elapsed time at the moment of action, e.g. '00:45' |
| `actionData` | Mixed | Tap payload, e.g. `{ zone: 4, points: 3 }` |

### 4.6 League Schema (Distance League)

A league runs the same Distance judging over several dates; each date holds N rounds, and
every round is materialized as an ordinary `Event` (§4.3) tagged with `leagueId` /
`leagueDateId` / `roundIndex`, so the scheduler, judge UI, and scoring are reused unchanged.

| Field | Type | Notes |
| --- | --- | --- |
| `_id` | ObjectId | Primary key |
| `name` | String | League title |
| `slug` | String | Unique shareable URL segment (`/l/:slug`) |
| `ownerId` | ObjectId (Ref: User) | The Admin who created it |
| `organizerIds` | Array&lt;ObjectId&gt; | Organizers assigned to manage it |
| `categoryId` | String | Fixed to `Distance` for now |
| `experienceLevels` | Array&lt;String&gt; | Which levels run (Beginner/Advanced) |
| `dates` | Array&lt;{ date, roundsCount, label? }&gt; | Organizer-chosen dates; `roundsCount` default 2 |
| `scoring.mode` | String (enum) | `bestOf` (default) \| `sum` |
| `scoring.bestN` | Number | Rounds counted when `mode = bestOf` |
| `minRestTimeMinutes` | Number | Propagated to each round Event |
| `activePitches` | Number | Propagated to each round Event |
| `status` | String (enum) | Planning \| Live \| Completed |

The master roster is imported once at the league level (`Registration.leagueId`) and cloned
onto each round Event. Standings aggregate each team's completed Distance round scores by
best-of-N (default) or sum, so a team that skips a date still ranks on its best runs.

---

## 5. API Design & Real-Time Communication

### 5.1 REST API Endpoints

| Method | Endpoint | Description | Auth |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Email + password → JWT + user | Public |
| GET | `/api/auth/me` | Current user from token | Authenticated |
| POST | `/api/auth/register` | Provision an Organizer/Judge/Admin account | Admin |
| POST | `/api/events` | Create a competition (unique slug, owner, organizers) | Admin |
| GET | `/api/events/slug/:slug` | Resolve a competition portal by slug | Public |
| PATCH | `/api/events/:id/organizers` | Assign/replace managing organizers | Admin |
| POST | `/api/events/import` | Ingest CSV/Excel file to create player and dog profiles | Admin / Organizer (owner) |
| POST | `/api/schedule/generate` | Trigger the intelligent scheduling algorithm | Admin / Organizer (owner) |
| PUT | `/api/heats/:id/status` | Update heat status (Pending, On-Deck, Live, Completed) | Admin / Organizer / Judge |
| POST | `/api/scoring/action` | Submit a judging tap action from the tablet and persist it to the action log | Admin / Organizer / Judge |
| POST | `/api/scoring/undo` | Remove the last action from the log on mistake | Admin / Organizer / Judge |
| GET | `/api/leaderboards/:eventId` | Retrieve ranked leaderboards split by experience level | Public |
| POST | `/api/leagues` | Create a Distance league | Admin |
| GET | `/api/leagues`, `/:id`, `/slug/:slug` | List/detail a league | Public |
| POST | `/api/leagues/:id/import` | Import the league master roster (Distance only) | Admin / Organizer (owner) |
| POST | `/api/leagues/:id/rounds/generate` | Materialize + schedule one round as an Event | Admin / Organizer (owner) |
| GET | `/api/leagues/:id/standings` | Aggregated best-of-N / sum standings | Public |

### 5.2 WebSocket Events (Socket.io)

**Server → Client**

- `live_score_updated` — Pushes cumulative score updates to audience screens during an active heat.
- `match_status_changed` — Notifies all clients who is currently on the field and who is next on deck.
- `freestyle_sync` — Synchronises the 4 Freestyle judging tablets in real time for a combined panel score.

**Client → Server**

- `join_event_room` — Client subscribes to updates for a specific event only (scoped rooms).

---

## 6. Frontend Architecture (React / Next.js)

### 6.1 Offline Resiliency (PWA)

- Service Workers cache judging screens and field layouts for use without network connectivity.
- Scoring actions and the active timer state are persisted in Local Storage / IndexedDB and synced back to the server via Background Sync once connectivity is restored.

### 6.2 Key UI Components

- `<JudgeDashboard />` — Manages the player queue for a given field.
- `<GameArena />` — Dynamic component that renders the field map and equipment layout based on the active discipline.
- `<ActionLogPanel />` — Displays the history of tap actions during a heat.
- `<SmartTimer />` — Resilient countdown/stopwatch component that survives page re-renders and offline events.
- **Undo FAB** — Floating Action Button overlaid on all judging screens; deletes the most recent action without disrupting the current flow.

---

## 7. Scheduling Algorithm Logic

### 7.1 Hard Constraints

- **Dog Rest Time** — A minimum mandatory rest period is enforced between any two heats involving the same dog.
- **Player Conflicts** — A player will not be scheduled on two fields simultaneously.
- **Judge Conflicts** — A judge will not be assigned to officiate during a heat in which they are also competing.

### 7.2 Dynamic Placeholders (Finals Slots)

The algorithm reserves empty placeholder slots in the schedule for finals rounds — 8 teams for J'Trail and 16 teams for Time Trail. These slots are automatically filled with the qualifying teams once the preliminary round concludes.

### 7.3 Soft Constraints & Analysis

- **Time Forecasting** — The scheduler compares total heat durations against the admin-defined time window and generates a 'field utilisation report' (e.g., 95% = tight schedule).
- **Auto-Delay Adjustment** — When cumulative delays are detected on a field, the algorithm automatically shifts subsequent heat times forward and broadcasts the updated schedule to all clients.

---

## 8. UI/UX Design

### 8.1 Styling (TailwindCSS)

- **Dark / Light Mode** — Built-in theme toggle to prevent sun glare on judge tablets used outdoors.
- **Design Language** — Sporty and modern aesthetic: rounded corners, soft shadows, and clear accent colours (e.g., neon green for live actions, electric blue for navigation).

### 8.2 Layout & Navigation

- **Judges Fat-Finger Friendly** — Oversized tap targets throughout to minimise mis-taps during competition.
- **Undo FAB** — Floating Action Button pinned to a screen corner for instant access without scrolling.
- **Public Dashboard** — Full responsiveness across screen sizes: mobile, tablet, and TV/projector.
  - **Mobile** — Bottom Navigation Bar for thumb-friendly access.
  - **Large Screens (TV / Projector)** — Auto-rotating Grid or Carousel cycling through all active fields automatically.

---

## 9. Non-Functional Requirements

### 9.1 Performance

- WebSocket events must propagate to all connected clients within 500 ms under normal network conditions.
- Schedule generation for up to 200 heats must complete in under 3 seconds.

### 9.2 Reliability

- Judge tablets must function fully offline and sync seamlessly upon reconnection with no data loss.
- The system must handle concurrent connections from multiple judges and hundreds of spectators without degradation.

### 9.3 Security

- JWT-based authentication for Admin and Judge roles.
- Public endpoints are read-only and require no authentication.
- All API endpoints are protected by role-based middleware (Admin/Judge/Public).

### 9.4 Accessibility

- WCAG 2.1 AA compliance for public-facing screens.
- High-contrast mode available for outdoor use.
