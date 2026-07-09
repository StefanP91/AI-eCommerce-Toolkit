#!/usr/bin/env bash
set -euo pipefail

cd /app

echo "==> Caching Laravel config..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

echo "==> Running database migrations..."
attempt=1
max_attempts=20
until php artisan migrate --force; do
  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "ERROR: migrations failed after ${max_attempts} attempts"
    exit 1
  fi
  echo "Migration attempt ${attempt} failed, retrying in 3s..."
  attempt=$((attempt + 1))
  sleep 3
done

if [ -n "${ADMIN_PROMOTE_EMAIL:-}" ]; then
  php artisan admin:promote "${ADMIN_PROMOTE_EMAIL}" || true
fi

echo "==> Starting API on port ${PORT:-10000}..."
exec php artisan serve --host=0.0.0.0 --port="${PORT:-10000}"
