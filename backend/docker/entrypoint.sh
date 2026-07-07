#!/usr/bin/env bash
set -euo pipefail

cd /app

php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan migrate --force

if [ -n "${ADMIN_PROMOTE_EMAIL:-}" ]; then
  php artisan admin:promote "${ADMIN_PROMOTE_EMAIL}" || true
fi

exec php artisan serve --host=0.0.0.0 --port="${PORT:-10000}"
