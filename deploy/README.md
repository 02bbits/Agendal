# Deploy (IM-65)

One Linux server. Cloudflare holds DNS and TLS; a non-root `cloudflared` on the host is the only way in
(outbound tunnel, no open web ports). The app runs as `compose.prod.yml`. Mail goes through Resend.
Spec: [Deployment](../docs/07-architecture/overview.md#deployment).

```
browser ─TLS─> Cloudflare ─tunnel─> cloudflared (host) ─> web :3000 (127.0.0.1) ─> api :8000 ─> db
                                                                                  queue, scheduler ─┘
```

## 1. Host (once)

- Deploy user `agendal` (in the `docker` group: that is root-equivalent, so nobody else is). Repo at `/srv/services/agendal` (any folder works: set it as `AGENDAL_DIR` below).
- SSH: keys only (`PasswordAuthentication no`, `PermitRootLogin no`).
- Firewall: deny all inbound except SSH. Optional: SSH through Cloudflare Access too, then close 22.
- Automatic security updates (`unattended-upgrades` or `dnf-automatic`).
- Packages: Docker with the compose plugin, `age`, `rclone`, `cloudflared`.

## 2. Cloudflare (dashboard)

- Tunnel: route `<domain>` to `http://localhost:3000`; config in [cloudflared.example.yml](cloudflared.example.yml).
- SSL/TLS: Always Use HTTPS on, minimum TLS 1.2. The app sends HSTS itself.
- Security: WAF managed rules on. One rate-limiting rule on `/api/v1/auth/*` (the app's own limits stay the real
  ones). Leave Bot Fight Mode off: it challenges the app's API calls.
- Caching: a cache rule that bypasses `/api/*` and `/sanctum/*`. `/_next/static/*` is cached by default.

## 3. Resend (mail)

- Add and verify `<domain>`; put its SPF and DKIM records in Cloudflare DNS (DNS only, not proxied).
- Add DMARC: `_dmarc.<domain>` TXT `v=DMARC1; p=quarantine; rua=mailto:<you>`.
- API key with Sending access for `<domain>` only; it is `MAIL_PASSWORD`.

## 4. First deploy

```sh
cd /srv/services/agendal
mkdir -m 700 secrets
openssl rand -base64 32 | tr -d '\n' > secrets/db_password
printf '%s' '<gemini key>' > secrets/gemini_api_key
# The API runs as uid 10001; compose secrets keep the host file's owner and mode
sudo chown 10001 secrets/gemini_api_key && chmod 400 secrets/gemini_api_key secrets/db_password
cp backend/.env.production.example backend/.env.production && chmod 600 backend/.env.production
# Fill backend/.env.production: domain, DB_PASSWORD (= secrets/db_password), MAIL_PASSWORD, then:
docker compose -f compose.prod.yml build
docker compose -f compose.prod.yml run --rm --no-deps api php artisan key:generate --show   # paste into APP_KEY
# Reminder keys (TK-6, see below), then:
docker compose -f compose.prod.yml up -d
docker compose -f compose.prod.yml exec api php artisan db:seed --force                      # demo account, once
```

Check: `ss -tlnp` lists only `127.0.0.1:3000` for the app; `curl -I https://<domain>` shows HSTS and CSP;
sign in as the demo account; ask for a password reset and check the mail shows SPF and DKIM pass.

### Reminder keys (TK-6)

Web Push needs a VAPID key pair. The private key goes straight into a secret file and is never printed;
the command prints the public key for `VAPID_PUBLIC_KEY` in `backend/.env.production`.

```sh
touch secrets/vapid_private_key   # compose wants every secret file to exist before any api container runs
docker compose -f compose.prod.yml run --rm --no-deps --user "$(id -u)" -v "$PWD/secrets:/out" api php artisan push:vapid /out/vapid_new
mv secrets/vapid_new secrets/vapid_private_key
sudo chown 10001 secrets/vapid_private_key && chmod 400 secrets/vapid_private_key
```

Keep the pair: a new one makes every device subscribe again (they do, quietly, next time the app opens).
Without the keys reminders are simply off. Check: the `scheduler` logs show `reminders:send` each minute,
and `docker compose -f compose.prod.yml logs queue` shows `reminders.sent` after one is due.

## 5. Update

```sh
cd /srv/services/agendal && git pull && docker compose -f compose.prod.yml up -d --build
```

The api container migrates on start; queue and scheduler wait for it.

**Since reminders (#186):** `compose.prod.yml` needs `secrets/vapid_private_key`. Make the keys once
([Reminder keys](#reminder-keys-tk-6)) before the first `up` after that pull, or compose stops on the
missing secret.

## 6. Backups

Nightly encrypted `pg_dump`, 7 days on the server and in R2 ([backup.sh](backup.sh)).

- Create an R2 bucket with a lifecycle rule deleting objects after 7 days, and an R2 API token with Object Read
  & Write on that bucket only. `rclone config`: remote `r2`, type S3, provider Cloudflare.
- `age-keygen -o agendal-backup.key` on a team member's machine, **not** the server. Only the public key goes
  on the server, so a leaked server or R2 token can't read the dumps.
- `/etc/agendal/backup.env`:
  ```sh
  AGENDAL_DIR=/srv/services/agendal
  AGE_RECIPIENT=age1...
  R2_BUCKET=agendal-backups
  ```
- `sudo cp deploy/agendal-backup.* /etc/systemd/system/ && sudo systemctl enable --now agendal-backup.timer`
- Run once: `sudo systemctl start agendal-backup`, then `journalctl -u agendal-backup`.

**Restore drill** (before the demo, scalability.md): on the machine with the private key,

```sh
age -d -i agendal-backup.key agendal-<time>.dump.age > agendal.dump
docker run -d --name restore -e POSTGRES_PASSWORD=x postgres:18
docker cp agendal.dump restore:/tmp/ && docker exec restore createdb -U postgres agendal
docker exec restore pg_restore -U postgres -d agendal --no-owner /tmp/agendal.dump
docker exec restore psql -U postgres -d agendal -c 'select count(*) from users'
docker rm -f restore
```

## Scaling on this box

The capacity model ([scalability.md](../docs/05-quality/scalability.md)) fits one server. If it gets busy:
more queue workers (`up -d --scale queue=2`), more PHP threads (`FRANKENPHP_CONFIG="num_threads 16"` on api),
then a bigger server.
