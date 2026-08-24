# Homelab Landing

A small dashboard for linking out to self-hosted apps/services on your home network. Add, edit, delete, and drag-and-drop reorder links, grouped into categories.

## Stack

- **Frontend**: static HTML/CSS/JS served by nginx, proxies `/api` to the backend
- **Backend**: Node/Express, SQLite (`better-sqlite3`) for storage
- **No auth** — intended for LAN-only use

## Run

```sh
docker compose up --build
```

Visit `http://<host>:8080`. Data persists in the `db-data` Docker volume.

## Development (without Docker)

```sh
cd backend
npm install
npm start        # runs on :3000
```

Then serve `frontend/public` with any static file server, proxying `/api` to `localhost:3000`, or open `frontend/public/index.html` directly and adjust API calls if needed.
