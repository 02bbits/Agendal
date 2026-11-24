#!/bin/sh
# API container start (IM-65). Caches read the env, so they are built here, not in the image.
# Only the api service migrates; queue and scheduler wait for it to be healthy.
set -e
php artisan config:cache
php artisan route:cache
php artisan event:cache
php artisan migrate --force
exec frankenphp run --config /etc/frankenphp/Caddyfile
