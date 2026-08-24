# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A small self-hosted dashboard for linking out to apps/services on a home network. Categories group links; both are drag-and-drop reorderable. No auth — intended for LAN-only use.

## Commands

Run with Docker (primary workflow):
```sh
docker compose up --build
```
Visit `http://<host>:10100` (see `docker-compose.yml` — frontend maps to host port 10100, backend has no exposed host port and is only reachable via the frontend's nginx proxy; the README's `:8080` is stale). Data persists in the `db-data` volume, mounted at `/app/data` in the backend container.

Backend only, without Docker:
```sh
cd backend
npm install
npm start        # node src/server.js, listens on :3000 (PORT env var)
```

Frontend without Docker: serve `frontend/public` with any static file server, proxying `/api` to `localhost:3000`, or open `frontend/public/index.html` directly and adjust API calls.

There is no build step, linter, or test suite configured in either `backend/` or `frontend/` — `package.json` only has a `start` script.

## Architecture

Two independent components composed via `docker-compose.yml`, with no shared code or build tooling between them:

- **`backend/`** — Node/Express API, SQLite via `better-sqlite3` (synchronous, no ORM). Entry point `src/server.js` mounts `src/routes/categories.js` and `src/routes/links.js` under `/api/categories` and `/api/links`. `src/db.js` opens/creates the SQLite file at `DATA_DIR/links.db` (default `backend/data/`) and runs `CREATE TABLE IF NOT EXISTS` on startup — there is no separate migration system, so schema changes are made directly in `db.js`'s `CREATE TABLE` statements.
- **`frontend/`** — Static HTML/CSS/vanilla JS (`frontend/public/`), no framework, no bundler. `app.js` fetches `/api/...` directly and does full client-side rendering/re-rendering (`render()`) after every mutation. Served by nginx in production (`nginx.conf`), which proxies `/api/` to the `backend` service and serves everything else as static files with SPA-style fallback to `index.html`.

### Data model

Two tables, both with a `sort_order` column that both the UI (drag-and-drop) and API (`PUT /api/{categories,links}/reorder`, taking an array of `{id, sort_order}`) treat as the source of ordering truth:

- `categories`: `id`, `name` (unique), `sort_order`.
- `links`: `id`, `name`, `url`, `description`, `category_id` (nullable FK to `categories`, `ON DELETE SET NULL` — deleting a category doesn't delete its links, it uncategorizes them), `sort_order`, `created_at`.

### Conventions worth knowing before editing routes

- Route handlers in `backend/src/routes/*.js` validate inline (no shared validation layer) and return JSON error bodies like `{ error: '...' }` with appropriate status codes (400/404/409).
- URLs are validated with `isValidUrl()` in `links.js`, which requires `http:`/`https:` protocol.
- `category_id` of `null`/absent means "uncategorized"; the frontend renders these under a synthetic "Uncategorized" section that has no edit/delete actions.
- Favicons in the UI are fetched client-side per-link (`faviconCandidates()` in `app.js`), trying the link's own `/favicon.ico` then a Google favicon service, falling back to an inline SVG — this is not backend behavior.
