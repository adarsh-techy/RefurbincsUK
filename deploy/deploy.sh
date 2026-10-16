#!/usr/bin/env bash
# Every deploy after setup. Run on the server: bash deploy/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null
docker compose ps
