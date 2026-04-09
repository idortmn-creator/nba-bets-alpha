# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this app is

A Hebrew-language (RTL) NBA Playoffs betting/prediction league app (2026 season). Users create or join private leagues, submit predictions for each playoff round, and earn points based on accuracy. The app is a PWA deployed on Firebase Hosting with Firestore as the database.

## Commands

```bash
npm run dev        # Start Vite dev server (hot reload)
npm run build      # TypeScript check + Vite production build → dist/
npm run preview    # Preview production build locally
```

## Deployment

**Push to `main` → auto-deploys via GitHub Actions** (`.github/workflows/deploy.yml`).

The workflow runs `npm ci && npm run build`, then deploys `dist/` to Firebase Hosting and Firestore security rules using the `FIREBASE_SERVICE_ACCOUNT` secret.

To deploy manually:
```bash
npm run build
firebase deploy --only hosting --project nba-bets-2026
firebase deploy --only firestore:rules --project nba-bets-2026
```

## Architecture

**React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui** — builds to `dist/`.

### Source layout (`src/`)

```
lib/           Firebase init, constants (stages, teams, scoring tables), utils
services/      Pure functions for Firestore operations (no React imports)
  auth.service.ts      Login, register, profile, password
  league.service.ts    Create/join/load leagues
  global.service.ts    Stage locks, teams, results, bonus bets, auto-lock, ESPN
  scoring.ts           scoreStage() and scoreStageDetail() — all scoring math
store/         Zustand stores (auth, global, league) — thin, no business logic
hooks/         React hooks binding stores to components
  useAuth.ts           onAuthStateChanged + global settings onSnapshot listener
  useGlobalHelpers.ts  Derived state: isSuperAdmin, isSeriesLocked, getTeams, etc.
  useLeague.ts         Open/close league with real-time onSnapshot
components/
  ui/          shadcn primitives (Button, Card, Input, SelectNative, Label, Separator)
  layout/      Header with hamburger menu
  auth/        Login/register page
  home/        Home grid (create/join/my leagues/admin)
  leagues/     Create, join, my-leagues list pages
  league/      League page wrapper + tab components:
    tabs/        LeaderboardTab, BetsViewTab, EnterBetsTab, PreBetsTab, RulesTab
  admin/       Global admin page + panels:
    panels/      StagePanel, TeamSetupPanel, ResultsPanel, BonusAdminPanel, AutoLockPanel, ESPNPanel
  profile/     Profile + password change
App.tsx        HashRouter + routes + Toaster
main.tsx       ReactDOM entry
```

### State management (Zustand)

- **`useAuthStore`** — `currentUser` (Firebase User), `currentUserDoc` (Firestore profile)
- **`useGlobalStore`** — `globalData` (the `global/settings` Firestore doc), `getGlobal(key, fallback)` selector
- **`useLeagueStore`** — `currentLeagueId`, `currentLeagueData` (active league doc)

Real-time listeners (`onSnapshot`) are set up in `useAuth` (global settings) and `useLeague` (active league).

### Routing

Hash-based routing via React Router (`HashRouter`):
- `/` → Home
- `/league/:lid/:tab?` → League page with tab
- `/admin` → Global admin (super admin only)
- `/profile`, `/leagues`, `/create-league`, `/join-league`

## Firebase / Firestore data model

Three collections, documented in `firestore.rules`:

| Collection | Purpose |
|---|---|
| `users/{uid}` | Profile: `displayName`, `username`, `email`, `leagues[]` |
| `leagues/{lid}` | League: members, bets (nested by UID and stage), results, teams, locks |
| `global/settings` | Single doc: current stage, stage/series locks, team names, results, bonus bets, auto-lock schedule |

**Admin tiers:**
- **Super Admin** — hardcoded UID (`aPgbjXex6lbB7N4X5j62Y4qqECV2`). Set in `src/lib/constants.ts` (`SUPER_ADMIN_UID`) and `firestore.rules`.
- **League Admin** — the user who created a league (`adminUid`).

## Playoff stages

Stages are identified by keys (not just integers): `0`, `'0b'`, `1`, `2`, `3`, `4` — in that order via `STAGE_KEYS`. This mixed number/string array is used for index lookups; always use `STAGE_KEYS.indexOf(si)` not direct array indexing.

| Key | Name |
|---|---|
| `0` | Play-In Round 1 (4 games) |
| `'0b'` | Play-In Finals (2 games) |
| `1` | First Round |
| `2` | Second Round |
| `3` | Conference Finals |
| `4` | NBA Finals |

Bets are stored per stage in Firestore as `bets.{uid}.stage{stageKey}`. Play-In bonus bets (stage `0b`) use the shared key `stage0` for storage.

## Scoring logic

All scoring is in `src/services/scoring.ts` — `scoreStage()` and `scoreStageDetail()`. Both take `(uid, stageKey, leagueData, globalData)` as pure functions. Points per correct prediction increase each round. Bonuses are awarded for sweeping all correct in a conference or all correct overall. Pre-bets (champion, east/west champ) are scored as part of stage 1.

## Locking mechanism

Bets lock when a stage or individual series is locked. Lock state lives in `global/settings`:
- `stageLocked[]` — array indexed by `STAGE_KEYS` position
- `seriesLocked{}` — map keyed as `"stageKey_matchKey"` (e.g., `"1_e1"`)

Locking a stage cascades to lock all series within it. Auto-lock entries in `autoLocks{}` are checked by a 30s polling interval in `useAuth.ts`.

## Key patterns

- **Services are pure** — no React, no store imports. They take data as params and call Firestore directly.
- **`useGlobalHelpers()`** — the main hook for derived state. All locking checks, team resolution, bonus logic.
- **`getTeams(si, mk)`** — priority: auto-computed from previous stage results → global manually-set → fallback empty.
- **Toast notifications** — `import { toast } from 'sonner'` everywhere.
- **RTL** — `<html dir="rtl" lang="he">`. Tailwind handles most layout; custom CSS in `src/index.css`.

## Legacy files

The old `app.js`, `style.css`, and `sw.js` are still in the repo root but are no longer used. The new app lives entirely in `src/`. `manifest.json`, `icon.png`, and `firestore.rules` are still active.
