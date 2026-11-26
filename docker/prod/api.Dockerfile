# Production image for the Laravel API (IM-65): FrankenPHP serves public/, no Nginx or PHP-FPM.
# Build from the repo root: docker compose -f compose.prod.yml build
FROM composer:2 AS vendor
WORKDIR /app
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --no-scripts --no-autoloader --prefer-dist --ignore-platform-reqs
COPY backend/ ./
RUN composer dump-autoload --no-dev --optimize --classmap-authoritative

FROM dunglas/frankenphp:1-php8.4
# bcmath: faster VAPID signing and payload encryption for reminders (TK-6)
RUN install-php-extensions pdo_pgsql intl pcntl bcmath zip
# pdftotext for note file upload (NoteExtractController)
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
COPY docker/prod/php.ini /usr/local/etc/php/conf.d/zz-agendal.ini
# Non-root (no port below 1024 needed): the fixed uid lets the host chown the LLM key secret to it
RUN useradd --uid 10001 --no-create-home agendal \
    && setcap -r /usr/local/bin/frankenphp \
    && chown -R agendal:agendal /config/caddy /data/caddy
WORKDIR /app
COPY --from=vendor --chown=agendal:agendal /app /app
# PlanValidator checks every note plan against the contract schemas (config/notes.php schema_path, ../docs from /app)
COPY docs/07-architecture/contracts/schemas /docs/07-architecture/contracts/schemas
RUN php artisan package:discover --ansi
COPY docker/prod/api-start.sh /usr/local/bin/api-start
USER agendal
# Plain HTTP on the internal network; Cloudflare holds TLS
ENV SERVER_NAME=:8000 \
    CADDY_GLOBAL_OPTIONS="admin off" \
    CADDY_SERVER_EXTRA_DIRECTIVES="header -Server"
EXPOSE 8000
CMD ["api-start"]
