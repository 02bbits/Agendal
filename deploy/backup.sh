#!/usr/bin/env bash
# Nightly database backup (IM-65, scalability.md "Data protection and operations"):
# pg_dump, encrypted with age, kept 7 days here and copied to Cloudflare R2.
# Needs on the host: docker, age, rclone with a remote named "r2" (see deploy/README.md).
# Runs as the deploy user: settings come from ~/.config/agendal/backup.env (AGENDAL_DIR, AGE_RECIPIENT,
# R2_BUCKET, optional BACKUP_DIR), loaded by agendal-backup.service.
set -euo pipefail
: "${AGENDAL_DIR:?}" "${AGE_RECIPIENT:?}" "${R2_BUCKET:?}"
out=${BACKUP_DIR:-$HOME/backups}
mkdir -p "$out"
umask 077
file="$out/agendal-$(date -u +%Y%m%dT%H%M%SZ).dump.age"

# Write to a temporary name so a failed dump never looks like a good backup
docker compose -f "$AGENDAL_DIR/compose.prod.yml" exec -T db pg_dump -U agendal -d agendal -Fc \
    | age -r "$AGE_RECIPIENT" > "$file.part"
mv "$file.part" "$file"

find "$out" -name 'agendal-*.dump.age' -mtime +7 -delete
# R2 keeps 7 days through a lifecycle rule on the bucket
rclone copy --s3-no-check-bucket "$file" "r2:$R2_BUCKET/"
# Pulse's Server health card shows the age of the last backup that reached R2 (#199)
docker compose -f "$AGENDAL_DIR/compose.prod.yml" exec -T api sh -c 'date -u +%s > storage/app/last-backup'
