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
| `DEBUG` | No | — | Set to `smx-tdb` for debug output |

\*Required when calling start.gg endpoints (`/api/startgg-import/*`, `/api/startgg/*`). Other routes work without it.

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
