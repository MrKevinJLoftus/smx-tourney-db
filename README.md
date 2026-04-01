# SMX Tournament DB

Web app for recording and exploring **StepManiaX (SMX)** tournament data: events, entrants, matches, songs, and scores. Operators use an authenticated admin area to create and edit records; visitors can browse results and match history.

## Technical summary

| Layer | Stack |
|--------|--------|
| **Frontend** | Angular 19, Angular Material, SCSS, RxJS |
| **Backend** | Node.js, Express 4 |
| **Data** | MySQL (`mysql` driver), SQL migrations under `api/database/migrations` |
| **Auth** | JWT-secured admin routes (`/api/user`, token checks on mutating endpoints) |
| **Integrations** | Optional start.gg import (GraphQL) for brackets and sets |

The API is organized as REST-ish resources under `/api/*` (e.g. events, players, matches, songs, browse summaries, start.gg import). The SPA calls those endpoints using a configurable `apiUrl` (relative `/api` in production when served by the same host).

This repo is a **small monorepo**: npm **workspaces** tie the UI and API together for installs and deployment.

## Repository layout

- **`smx-tdb/`** — Angular application (`ng serve` for local UI, `ng build` for production bundles).
- **`api/`** — Express app (`server.js` → `app.js`), controllers, routes, MySQL connector, start.gg services.
- **`scripts/copy-ui-to-api.js`** — Copies the production Angular build into `api/ui/`, which Express serves as static files and as the SPA shell (`index.html` fallback).
- **Root `package.json`** — Workspace root; `start` / Procfile `web` run `node api/server.js`. `heroku-postbuild` builds the Angular app and runs the copy script.

## Local development

1. **MySQL** — Apply migrations (see `api/database/migrations/`, starting from `schema.sql` as appropriate for your environment).
2. **Install** — From the repo root, run `npm install` (installs both workspaces).
3. **API** — From `api/`, add a `.env` file (do not commit) with database and JWT settings (see below). Start with `npm start` so `dotenv` loads `api/.env` (default port `3000`).
4. **Angular** — From `smx-tdb/`, run `npm start` (`ng serve`). Ensure `src/environments/environment.ts` points at your API (e.g. `http://localhost:3000/api`).

## Configuration (API)

Expected environment variables include (names only; values are environment-specific):

- **Database:** `CLEARDB_HOST`, `CLEARDB_USER`, `CLEARDB_PASS`, `CLEARDB_DB` (or equivalent MySQL credentials your `connector` expects).
- **Auth:** `SMX_TDB_JWT_KEY` — secret for signing JWTs.
- **Server:** `PORT` (Heroku sets this automatically).
- **start.gg:** `START_GG_API_KEY` — optional, for import features.

## Deployment (Heroku)

Deploy from the **repository root** with the Heroku Node buildpack. The slug should run `npm install` for workspaces, then `heroku-postbuild` (Angular production build + copy to `api/ui`). The `Procfile` runs `web: node api/server.js`. Set the same env vars as in production MySQL/JWT/start.gg.

---

*MIT license (see `api/package.json` for package metadata).*
