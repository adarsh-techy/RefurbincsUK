# Refurbinics

Admin dashboard for a battery repair company. See [spec.md](./spec.md) for functional requirements.

## Stack

- **Frontend**: React, Redux Toolkit, React Router, Tailwind CSS (Vite)
- **Backend**: Node.js, Express
- **Database**: PostgreSQL

## Project structure

```
refurbinics/
├── backend/     Express API (see backend/README.md)
├── frontend/    React admin dashboard (see frontend/README.md)
└── spec.md      Functional spec
```

## Getting started

### 1. Database

Create a local PostgreSQL database matching `backend/.env` (`DB_NAME=refurbinics` by default).

### 2. Backend

```
cd backend
npm install
npm run migrate   # creates tables
npm run dev        # http://localhost:5000
```

### 3. Frontend

```
cd frontend
npm install
npm run dev         # http://localhost:5173
```

Each project has its own `.env` (already populated with local defaults) and `.env.example` as a template.

## Docker

Runs the whole stack (Postgres + backend + frontend + Caddy for automatic HTTPS) in containers — no local Node/Postgres install needed, and no manually-managed TLS certs.

### One-time setup (per server)

```
cp .env.example .env
```

Fill in every value in `.env` — `SITE_ADDRESS` (`:80` for IP-only HTTP, or a hostname with its DNS A record pointed at the server for automatic HTTPS), `DB_PASSWORD`, `JWT_SECRET`, `CLIENT_URL`, `VITE_API_URL`. On a fresh DigitalOcean droplet run `deploy/server-setup.sh` as root first (installs Docker, firewall, swap, nightly DB backups, clones the repo). Every value is required; the stack refuses to start if any are missing, on purpose — there's no safe default for a database password or a signing secret. `.env` is git-ignored and untouched by `git pull`, so this is a one-time step per server, not a per-deploy one.

### Every deploy after that

```
git pull
docker compose up -d --build
```

- Caddy is the only thing with public ports (`80`/`443`) — it terminates HTTPS (automatic Let's Encrypt certificate when `SITE_ADDRESS` is a hostname) and path-routes one address: `/api`, `/uploads`, `/socket.io` go to the backend, everything else to the frontend. Postgres, the backend, and the frontend containers publish **no** ports to the host — only reachable from each other over the internal Compose network.
- `VITE_API_URL` is baked into the frontend bundle at *build* time — changing it requires `docker compose build frontend`, and it must be the public URL a browser can reach (`http://<ip>/api` or `https://app.yourdomain.com/api`), not the internal `backend` service name.
- `CLIENT_URL` must match the public URL the browser opens the app at, or the API rejects the browser's requests (CORS).
- Migrations run automatically on every backend start (tracked in a `schema_migrations` table, so re-applying is a safe no-op once applied) — no separate migration step to remember.
- Backend and frontend both run as non-root users, have healthchecks, and log with rotation (`max-size: 10m`, `max-file: 3`) so container logs don't fill the disk.
- Every deploy after setup: `bash deploy/deploy.sh` on the server (`git pull` + rebuild).
- `deploy/server-setup.sh` installs a nightly `pg_dump` cron into `/var/backups/refurbnics` (14 days kept).
