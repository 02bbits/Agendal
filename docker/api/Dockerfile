# Dev image for the Laravel API; the code is bind-mounted, not copied.
FROM php:8.4-cli

RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip libpq-dev libicu-dev libzip-dev libxml2-dev \
    poppler-utils \
    && docker-php-ext-install pdo_pgsql intl pcntl zip dom \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
# Dictation sends up to 2 minutes of WAV (about 3.8 MB, NC §2.3); PHP's default is 2M
RUN printf 'upload_max_filesize = 5M\npost_max_size = 8M\n' > /usr/local/etc/php/conf.d/zz-agendal-uploads.ini
ENV COMPOSER_HOME=/tmp/composer

WORKDIR /repo/backend
