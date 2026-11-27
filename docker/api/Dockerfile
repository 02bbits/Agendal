# Dev image for the Laravel API; the code is bind-mounted, not copied.
FROM php:8.4-cli

# gd and exif: a photo is re-encoded upright without its metadata before the model reads it (SC-25)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip libpq-dev libicu-dev libzip-dev libxml2-dev \
    libpng-dev libjpeg62-turbo-dev libwebp-dev \
    poppler-utils \
    && docker-php-ext-configure gd --with-jpeg --with-webp \
    && docker-php-ext-install pdo_pgsql intl pcntl zip dom gd exif \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
# Dictation sends up to 2 minutes of WAV (about 3.8 MB, NC §2.3) and File to note up to 5 MB (NC §2.4);
# PHP's default is 2M
RUN printf 'upload_max_filesize = 6M\npost_max_size = 8M\n' > /usr/local/etc/php/conf.d/zz-agendal-uploads.ini
ENV COMPOSER_HOME=/tmp/composer

WORKDIR /repo/backend
