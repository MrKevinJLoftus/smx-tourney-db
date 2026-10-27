# SMX Tournament DB — API

Express 4 REST API for the [SMX Tournament DB](../README.md) project. It serves JSON under `/api/*`, optionally hosts the production Angular build from `ui/`, and connects to MySQL for events, players, matches, songs, ratings, and start.gg import.

## Prerequisites

- **Node.js** 20+ (see root `package.json` `engines`)
- **MySQL** 8.x (or compatible) with a database created for this app

## Quick start

1. **Install dependencies** — from the repository root:

   ```bash
   npm install
   ```

   Or from this directory only:

   ```bash
   npm install
   ```

2. **Set up the database** — create a MySQL database, then apply migrations in `database/migrations/`:

   - Run `schema.sql` first on an empty database.
   - Apply the remaining `migration_*.sql` and `add_*.sql` files in an order that matches your existing environment (fresh installs typically run all migrations after `schema.sql`).
   - Optionally run `seed-songs.sql` for initial song data.

3. **Configure environment** — copy the template below into a `.env` file (see [Environment variables](#environment-variables)).

4. **Start the server**:

   ```bash
   npm start
   ```

   The API listens on `http://localhost:3000` by default. Health check: any request to `/api/browse/...` or `GET /api/song` (public routes) should hit the database.

For UI development, run the Angular app separately from `smx-tdb/` and point `environment.ts` at `http://localhost:3000/api`.

## Environment variables

Configuration is loaded with [dotenv](https://github.com/motdotla/dotenv) when `app.js` starts. **dotenv reads `.env` from the process current working directory**, not relative to this folder:

| How you start the API | Where to put `.env` |
|------------------------|---------------------|
| `npm start` inside `api/` | `api/.env` |
| `npm start` from repository root (`node api/server.js`) | Repository root `.env` |

On Heroku and other hosts, set the same variables as platform config vars (no `.env` file).

### `.env` template

Copy into `.env` and replace placeholder values. **Do not commit `.env`.**

```env
# --- Required ---

# MySQL connection (names are legacy ClearDB-style; any MySQL host works)
CLEARDB_HOST=127.0.0.1
CLEARDB_USER=smx_tdb
CLEARDB_PASS=your_mysql_password
CLEARDB_DB=smx_tdb

# Secret used to sign and verify JWTs for admin auth (use a long random string)
SMX_TDB_JWT_KEY=change-me-to-a-long-random-secret

# --- Optional ---

# HTTP port (default: 3000). Heroku sets PORT automatically.
# PORT=3000

# start.gg GraphQL API token (Bearer). Required only for start.gg import and upcoming-events features.
# Get a key from https://developer.start.gg/docs/authentication
# START_GG_API_KEY=

# StepManiaX videogame IDs on start.gg for discovery/import/upcoming lists.
# Use a comma-separated list, or a single ID. Defaults: 33834,55766
# START_GG_STEPMANIAX_VIDEOGAME_IDS=33834,55766
# START_GG_STEPMANIAX_VIDEOGAME_ID=33834

# blamethepads (formerly piu-tourney-maker) Supabase project, for the blamethepads / ddr.tools import tab.
# Copy both from any request blamethepads.com makes to *.supabase.co in browser dev tools:
# the URL is https://<project-id>.supabase.co and the key is the `apikey` request header (public anon key).
# BLAMETHEPADS_SUPABASE_URL=https://<project-id>.supabase.co
# BLAMETHEPADS_SUPABASE_ANON_KEY=

# Override the ddr.tools PartyKit host (default: ddr-card-draw-party.noahm.partykit.dev)
# DDRTOOLS_PARTY_HOST=

# Override the StepManiaX song data used by Admin Panel > Import Songs
# (default: https://raw.githubusercontent.com/noahm/DDRCardDraw/main/src/songs/smx.json)
# SMX_SONGS_JSON_URL=

# Weekly challenge leaderboards (scores pulled from the smx.573.no score browser API)
# SMX573_BASE_URL=https://smx.573.no
# Time zone that defines the Monday-to-Sunday challenge week (default: America/New_York)
# WEEKLY_CHALLENGE_TZ=America/New_York
# Secret mixed into the weekly chart draw so future weeks can't be precomputed
# WEEKLY_CHALLENGE_SALT=
# Minutes before the current week's scores are refetched (default: 10)
# WEEKLY_CHALLENGE_REFRESH_MINUTES=10
# First Monday (YYYY-MM-DD) counted by the all-time weekly challenge leaderboard; unset = no history saved
# WEEKLY_CHALLENGE_LAUNCH_WEEK=
# Hours after a week ends before its results are saved, to allow for late score uploads (default: 6)
# WEEKLY_CHALLENGE_FINALIZE_DELAY_HOURS=6

# Enable debug logging from server.js (namespace: smx-tdb)
# DEBUG=smx-tdb
```

### Variable reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLEARDB_HOST` | Yes | — | MySQL hostname |
| `CLEARDB_USER` | Yes | — | MySQL username |
| `CLEARDB_PASS` | Yes | — | MySQL password |
| `CLEARDB_DB` | Yes | — | MySQL database name |
| `SMX_TDB_JWT_KEY` | Yes | — | JWT signing secret for login and protected routes |
| `PORT` | No | `3000` | TCP port for `server.js` |
| `START_GG_API_KEY` | No* | — | start.gg API bearer token |
| `START_GG_STEPMANIAX_VIDEOGAME_IDS` | No | `33834`, `55766` | Comma-separated start.gg videogame IDs |
| `START_GG_STEPMANIAX_VIDEOGAME_ID` | No | (see above) | Single videogame ID if the list var is unset |
| `BLAMETHEPADS_SUPABASE_URL` | No** | — | blamethepads Supabase project URL |
| `BLAMETHEPADS_SUPABASE_ANON_KEY` | No** | — | blamethepads Supabase public anon key |
| `DDRTOOLS_PARTY_HOST` | No | `ddr-card-draw-party.noahm.partykit.dev` | ddr.tools room state host |
| `SMX_SONGS_JSON_URL` | No | ddr.tools `smx.json` on GitHub | Song data for the song catalog refresh |
| `SMX573_BASE_URL` | No | `https://smx.573.no` | Score browser API used by the weekly challenge |
| `WEEKLY_CHALLENGE_TZ` | No | `America/New_York` | Time zone for the Monday–Sunday challenge week |
| `WEEKLY_CHALLENGE_SALT` | No | — | Secret mixed into the weekly chart draw |
| `WEEKLY_CHALLENGE_REFRESH_MINUTES` | No | `10` | How long the current week's scores are cached |
| `WEEKLY_CHALLENGE_LAUNCH_WEEK` | No | — | First Monday counted by the all-time leaderboard; history is off when unset |
| `WEEKLY_CHALLENGE_FINALIZE_DELAY_HOURS` | No | `6` | Hours after a week ends before its results are saved |
| `DEBUG` | No | — | Set to `smx-tdb` for debug output |

\*Required when calling start.gg endpoints (`/api/startgg-import/*`, `/api/startgg/*`). Other routes work without it.

\*\*Required for blamethepads imports and the blamethepads tourney list. ddr.tools imports work without them, but linked draws then get placeholder event names and no event date.

### blamethepads / ddr.tools import

`/api/tourney-import` (admin only) imports players, rounds, charts and per-chart scores. Apply `migration_add_external_sources.sql` first.

- `GET /blamethepads/tourneys` — StepManiaX tourneys on blamethepads, with the local event id if already imported.
- `POST /preview` `{ source: 'blamethepads' | 'ddrtools', ref }` — fetch and show what would be imported; writes nothing.
- `POST /import` — same body; imports every round not imported before, then rebuilds ratings.

`ref` is a blamethepads tourney URL/id or a ddr.tools event URL (`https://next.ddr.tools/e/<CODE>/…`)/room code. ddr.tools draws created from blamethepads carry the blamethepads tourney and round ids, so both sources dedupe against the same keys (`match_external_source`) and one event per blamethepads tourney. Each round becomes one match; gauntlet rounds (3+ players) are stored with all scores but stay out of Glicko ratings, which only count 1v1 matches. Charts are matched to the local song list by title/artist and difficulty; unmatched charts are listed in the preview and imported without a song link, so refresh the song catalog first.

### Song catalog refresh

`POST /api/song/catalog/preview` and `POST /api/song/catalog/import` `{ applyLevelChanges?: boolean }` (admin only) sync `song` / `song_x_chart` with the ddr.tools StepManiaX song data. Songs match on title + artist, and charts on song + mode (e.g. `Hard+`). Missing songs and charts are added; level re-rates are applied only with `applyLevelChanges`; nothing is deleted.

### Weekly challenge

`GET /api/weekly-challenge?week=<offset>` (public) returns the Easy, Hard, Wild, Dual and Full challenge leaderboards for a Monday–Sunday week; `week` is `0` for the current week (default) down to `-8`. Each difficulty gets 3 charts (including `+` charts), one drawn from each third of that difficulty's level range. The draw is seeded by the week, so it is the same on every restart and nothing is written to the database. Scores are each player's best 100%-speed score on the chart within the week, read from the [smx.573.no](https://smx.573.no/browser) score browser API and cached in memory. The overall standings sum a player's best score on each of the 3 charts; equal scores share a rank.

`GET /api/weekly-challenge/all-time` (public) returns, per difficulty, how many 1st place and top 10 finishes each player has in the overall standings, counting weeks from `WEEKLY_CHALLENGE_LAUNCH_WEEK` onward. Apply `migration_add_weekly_challenge_history.sql` and then `migration_add_weekly_challenge_dual.sql` first. A week is saved (its drawn chart ids plus every player ranked 10th or better, including ties) the first time either weekly challenge endpoint is called after the week ends plus `WEEKLY_CHALLENGE_FINALIZE_DELAY_HOURS`. Scores are fetched fresh for this, not from the cache. To save or re-save weeks by hand:

```bash
node -r dotenv/config scripts/finalize-weekly-challenge.js                       # all ended, unsaved weeks
node -r dotenv/config scripts/finalize-weekly-challenge.js --week 2026-11-02 --replace
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run `node server.js` |
| `npm run debug` | Run with `nodemon` for auto-reload |

Utility scripts under `scripts/` expect env vars loaded via dotenv, e.g.:

```bash
node -r dotenv/config scripts/test-startgg-import-queries.js
```

## API routes

| Prefix | Purpose |
|--------|---------|
| `/api/user` | Login, signup (admin), password update |
| `/api/event` | Tournament events |
| `/api/player` | Players |
| `/api/eventPlayer` | Event entrants |
| `/api/match` | Matches and scores |
| `/api/song` | Song catalog |
| `/api/browse` | Public browse/summary data |
| `/api/startgg-import` | Admin start.gg import (requires `START_GG_API_KEY`) |
| `/api/startgg` | Public start.gg upcoming events |
| `/api/tourney-import` | Admin blamethepads / ddr.tools results import |
| `/api/weekly-challenge` | Public weekly challenge leaderboards (smx.573.no scores) |
| `/api/seed` | Seed helpers |

Mutating admin routes require a valid JWT (`Authorization: Bearer <token>`) from `POST /api/user/login`.

## Project layout

```
api/
├── app.js              # Express app, routes, static UI
├── server.js           # HTTP server (PORT)
├── controllers/        # Request handlers
├── routes/             # Route definitions
├── queries/            # SQL query strings
├── services/           # start.gg, ratings, player resolution
├── middleware/         # Auth, logging
├── database/
│   ├── connector.js    # MySQL pool (CLEARDB_* env vars)
│   └── migrations/     # Schema and migrations
└── ui/                 # Production Angular build (populated by root build script)
```

## Deployment

Production deploys typically run from the **repository root**: `heroku-postbuild` builds the Angular app into `api/ui/`, and the `Procfile` runs `node api/server.js`. Set the environment variables on the host the same way as in the `.env` template above.

See the [root README](../README.md) for monorepo and Heroku details.
