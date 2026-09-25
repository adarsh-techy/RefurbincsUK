FROM node:20-alpine

WORKDIR /app

# Deps installed before source is copied, so editing src/ doesn't bust the
# npm ci layer cache — only a package.json/lock change does.
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src

ENV NODE_ENV=production
EXPOSE 5000

# The official alpine image ships a preconfigured unprivileged "node" user
# (uid 1000) — run as that instead of root. The controllers create and write
# to uploads/<kind> (client logos, invoices, staff docs, issue photos, return
# docs) at import time, so that tree must exist and be owned by "node"
# before we drop privileges, or the very first require() fails with EACCES.
# Mount a persistent volume at /app/uploads in production — the container
# filesystem is discarded on every deploy.
RUN mkdir -p /app/uploads/client-logos /app/uploads/invoices /app/uploads/staff-docs \
             /app/uploads/issue-photos /app/uploads/return-docs \
 && chown -R node:node /app/uploads
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health || exit 1

# Migrations are tracked in a schema_migrations table (see src/db/migrate.js),
# so re-running them on every start is a safe no-op once applied — no
# separate migration step to remember before deploying a new image. `exec`
# replaces the shell with node directly so it becomes PID 1 and receives
# SIGTERM from `docker stop` — without it, `sh -c "a && b"` leaves sh as
# PID 1 and can swallow the signal, making shutdown hang for the full grace
# period before Docker SIGKILLs the container.
CMD ["sh", "-c", "npm run migrate && exec node src/server.js"]
