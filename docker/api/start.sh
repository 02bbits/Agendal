#!/bin/sh
# First run sets up vendor/, .env and the app key; every run migrates and seeds.
set -e
# Reuse installed packages on restart; refresh them when dependency files change.
if [ ! -f vendor/autoload.php ] || [ ! -f vendor/composer/installed.json ] || [ composer.lock -nt vendor/composer/installed.json ] || [ composer.json -nt vendor/composer/installed.json ]; then
    composer install --no-interaction
fi
[ -f .env ] || cp .env.example .env
grep -q '^APP_KEY=.' .env || php artisan key:generate
php artisan migrate --seed --force
# --no-reload: without it, serve drops DB_HOST and other compose env vars from its workers
exec php artisan serve --host=0.0.0.0 --port=8000 --no-reload
