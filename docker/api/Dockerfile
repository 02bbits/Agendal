# Dev image for the Laravel API; the code is bind-mounted, not copied.
FROM php:8.4-cli
RUN apt-get update && apt-get install -y --no-install-recommends git unzip libpq-dev libicu-dev \
    && docker-php-ext-install pdo_pgsql intl pcntl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
ENV COMPOSER_HOME=/tmp/composer
WORKDIR /repo/backend
