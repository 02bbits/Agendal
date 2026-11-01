#!/bin/sh
# First run sets up vendor/, .env and the app key; every run migrates and seeds.
set -e
composer install --no-interaction
[ -f .env ] || cp .env.example .env
grep -q '^APP_KEY=.' .env || php artisan key:generate
php artisan migrate --seed --force
# --no-reload: without it, serve drops DB_HOST and other compose env vars from its workers
exec php artisan serve --host=0.0.0.0 --port=8000 --no-reload
