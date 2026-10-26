#!/usr/bin/env bash
# Run as root only after uploading and extracting the release. First install/update.
set -euo pipefail
test "$(id -u)" = 0
SITE_HOST="${1:?Pass the public DNS name without protocol}"
ADMIN_EMAIL="${2:?Pass the initial administrator login email}"
[[ "$SITE_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$ ]]
VM_USER="$(cat /etc/dpp-deploy-user)"
id "$VM_USER" >/dev/null
test "$VM_USER" != root
APP=/srv/dpp/cards/app
CONFIG=/srv/dpp/config/cards.env
test -f "$APP/package-lock.json"
test -f "$APP/migrations/001-initial.sql"
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)'
install -d -o dppapp -g dppapp -m 0700 /srv/dpp/cards/storage
install -d -o "$VM_USER" -g dppapp -m 2750 /srv/dpp/cards/brand
chown -R "$VM_USER":dppapp "$APP"
chmod -R u=rwX,g=rX,o= "$APP"
runuser -u "$VM_USER" -- bash -c 'cd /srv/dpp/cards/app && npm ci --omit=dev --no-fund --no-audit --cache /srv/dpp/uploads/npm-cache'
if test ! -f "$CONFIG"; then
  DB_PASSWORD="$(openssl rand -hex 32)"
  SESSION_VALUE="$(openssl rand -hex 48)"
  mysql <<SQL
CREATE DATABASE IF NOT EXISTS digital_cards CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'cards_app'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';
GRANT SELECT,INSERT,UPDATE,DELETE ON digital_cards.* TO 'cards_app'@'localhost';
SQL
  umask 077
  cat > "$CONFIG" <<ENV
NODE_ENV=production
HOST=127.0.0.1
PORT=3600
PUBLIC_ORIGIN=https://${SITE_HOST}
DATABASE_URL=mysql://cards_app:${DB_PASSWORD}@127.0.0.1:3306/digital_cards
SESSION_SECRET=${SESSION_VALUE}
STORAGE_DIR=/srv/dpp/cards/storage
BRAND_FILE=
PRIVACY_CONTROLLER=
PRIVACY_CONTACT=
PRIVACY_NOTICE=
RETENTION_DAYS=30
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=
ENV
  chown "$VM_USER":"$(id -gn "$VM_USER")" "$CONFIG"
  chmod 0600 "$CONFIG"
  unset DB_PASSWORD SESSION_VALUE
fi
# Schema changes use the local privileged socket; the running app cannot perform DDL.
mysql digital_cards < "$APP/migrations/001-initial.sql"
if test "$(mysql -Nse "SELECT COUNT(*) FROM digital_cards.users WHERE role='admin' AND active=1")" = 0; then
  cd "$APP"
  umask 077
  runuser -u "$VM_USER" -- node --env-file="$CONFIG" src/cli.js user:add --email "$ADMIN_EMAIL" > /srv/dpp/config/cards-first-login.txt
  chown "$VM_USER":"$(id -gn "$VM_USER")" /srv/dpp/config/cards-first-login.txt
  chmod 0600 /srv/dpp/config/cards-first-login.txt
fi
for UNIT in dpp-cards dpp-cards-worker; do
  install -m 0644 "$APP/deploy/${UNIT}.service" "/etc/systemd/system/${UNIT}.service"
done
systemctl daemon-reload
systemctl enable --now dpp-cards dpp-cards-worker
systemctl restart dpp-cards dpp-cards-worker
systemctl is-active dpp-cards dpp-cards-worker
printf '%s\n' 'Installed. Configure privacy, optional brand/SMTP, HTTPS, import drafts and publish via /admin.'
