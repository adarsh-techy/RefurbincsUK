#!/usr/bin/env bash
# One-time bootstrap for a fresh Ubuntu 22.04/24.04 DigitalOcean droplet.
# Run as root:  bash server-setup.sh
# Installs Docker + compose plugin, a firewall (22/80/443 only), unattended
# security updates, a 2 GB swapfile (small droplets OOM during `vite build`
# otherwise), and clones the repo to /opt/refurbnics.
set -euo pipefail

# Private repo: pass a read-only token, e.g.
#   REPO_URL=https://<user>:<token>@github.com/adarsh-refurbincs-work/refurbincs-battery-management.git bash server-setup.sh
REPO_URL="${REPO_URL:-https://github.com/adarsh-refurbincs-work/refurbincs-battery-management.git}"
APP_DIR="${APP_DIR:-/opt/refurbnics}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y ca-certificates curl git ufw unattended-upgrades

# --- Docker (official repo) ---
if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

# --- Swap (skip if any swap already active) ---
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# --- Firewall ---
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# --- Unattended security updates ---
dpkg-reconfigure -f noninteractive unattended-upgrades

# --- Repo ---
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"
[ -f .env ] || cp .env.example .env

# --- Nightly DB backup (kept 14 days) ---
mkdir -p /var/backups/refurbnics
cat > /etc/cron.d/refurbnics-backup <<CRON
15 2 * * * root cd $APP_DIR && docker compose exec -T db pg_dump -U \$(grep ^DB_USER .env | cut -d= -f2) \$(grep ^DB_NAME .env | cut -d= -f2) | gzip > /var/backups/refurbnics/db-\$(date +\%F).sql.gz && find /var/backups/refurbnics -name 'db-*.sql.gz' -mtime +14 -delete
CRON

echo
echo "Done. Next:"
echo "  1. nano $APP_DIR/.env   (fill SITE_ADDRESS, DB_PASSWORD, JWT_SECRET, CLIENT_URL, VITE_API_URL)"
echo "  2. cd $APP_DIR && docker compose up -d --build"
