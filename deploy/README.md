# Deploying Eventia to Oracle Cloud Always Free

Runs the whole platform — Angular SPA, NestJS API, PostgreSQL — on a single
Always Free A1.Flex VM behind Caddy, with a real Let's Encrypt certificate and
no domain name.

| | |
| --- | --- |
| **Cost** | $0 (Always Free tier; a card is required to sign up but is not charged) |
| **Public entry point** | `https://<your-public-ip>` |
| **Certificate** | Let's Encrypt IP certificate (short-lived, auto-renewed by Caddy) |
| **Compose services** | `postgres`, `migrate`, `backend`, `frontend-assets`, `caddy` |
| **Images** | backend 662 MB, frontend 94.7 MB |
| **Disk** | ~1 GB of images, plus database and uploads |

Payments stay simulated, as everywhere else in this project.

---

## Contents

1. [How it fits together](#1-how-it-fits-together)
2. [Create the VM in the Oracle console](#2-create-the-vm-in-the-oracle-console)
3. [Open the firewall](#3-open-the-firewall)
4. [Provision the machine](#4-provision-the-machine)
5. [Configure the deployment](#5-configure-the-deployment)
6. [Build and start](#6-build-and-start)
7. [Create the first administrator](#7-create-the-first-administrator)
8. [Verify the deployment](#8-verify-the-deployment)
9. [Day-to-day operations](#9-day-to-day-operations)
10. [Backups and restore](#10-backups-and-restore)
11. [Updating the deployment](#11-updating-the-deployment)
12. [Troubleshooting](#12-troubleshooting)
13. [What has and has not been verified](#13-what-has-and-has-not-been-verified)

---

## 1. How it fits together

```
Internet ──80/443──> Caddy (public IP)
                      ├── /api/*     → backend:3000        (NestJS)
                      ├── /uploads/* → uploads volume      (event cover images)
                      └── /*         → frontend_www volume (Angular SPA)
                                        │
                          postgres:5432 ─┴─ volume pgdata
```

One origin serves both the API and the SPA, which keeps authentication simple:
the refresh cookie is `SameSite=Lax`, so the browser only sends it when the two
live on the same site. Splitting them onto a subdomain would require
`SameSite=None; Secure` plus a matching CORS policy.

| Service | Role | Restart policy |
| --- | --- | --- |
| `postgres` | PostgreSQL 17. No published port — only the compose network reaches it. | `unless-stopped` |
| `migrate` | Applies the 7 TypeORM migrations, then exits. | `no` (one-shot) |
| `backend` | NestJS API on `:3000`. Not published; Caddy proxies to it. | `unless-stopped` |
| `frontend-assets` | Copies the built Angular bundle into the `frontend_www` volume, then exits. | `no` (one-shot) |
| `caddy` | TLS, ACME issuance, routing, SPA fallback. | `unless-stopped` |

Ordering is handled by compose: `backend` waits for `migrate` to exit `0`, and
`caddy` waits for `backend` to pass its health check. `docker compose up -d`
converges on its own.

**Two volumes hold data:** `pgdata` (the database) and `uploads` (event cover
images). Both survive `docker compose down` and `restart`; only `down -v`
deletes them.

---

## 2. Create the VM in the Oracle console

Always Free A1 shapes are frequently out of capacity in busy regions. If
"Create" is greyed out or you hit "Out of host capacity", wait and retry, or try
a smaller shape.

1. Sign in to the [Oracle Cloud console](https://cloud.oracle.com/).
2. **Compute → Instances → Create instance**.
3. **Name**: `eventia`.
4. **Image and shape → Change image**: **Oracle Linux → Canonical Ubuntu →
   Ubuntu 24.04** (aarch64).
5. **Change shape → Ampere → VM.Standard.A1.Flex**:
   - **2 OCPUs** and **12 GB RAM** — this is the full Always Free allowance.
   - Leave the boot volume at 50 GB.
6. **Networking**: create a new VCN when prompted. Note the subnet and the
   default security list; you need them in the next step.
7. **Add SSH keys**: paste an existing public key
   (`cat ~/.ssh/id_ed25519.pub`), or let Oracle generate one and download the
   private key — you will need it to connect.
8. **Boot volume**: 50 GB, disable auto-expand.
9. **Create**.

When it reaches RUNNING, copy the **Public IP address** from the instance
details page. That value becomes `PUBLIC_SITE_ADDRESS`.

> **Always Free caveat.** Oracle may reclaim Always Free compute instances that
> appear idle, and CPU-based A1 shapes are the most exposed. Regular traffic to
> the site is the main thing that keeps an instance counted as in use.

---

## 3. Open the firewall

Oracle has **two** firewalls. `vm-setup.sh` configures the one inside the VM;
this step is the network-level security list, which cannot be changed from
inside the machine.

**Networking → VCN → Security Lists → Default Security List → Add Ingress Rules**:

| Source CIDR | Protocol | Dest port | Purpose |
| --- | --- | --- | --- |
| `0.0.0.0/0` | TCP | `22` | SSH |
| `0.0.0.0/0` | TCP | `80` | ACME HTTP-01 challenge, and the HTTPS redirect |
| `0.0.0.0/0` | TCP | `443` | HTTPS |
| `0.0.0.0/0` | UDP | `443` | HTTP/3 |

The UDP rule is the easy one to miss. Without it everything still works over
HTTP/2 — you simply lose HTTP/3, and nothing appears in the logs to tell you
why.

Leave egress rules untouched. Outbound HTTPS is required to reach Let's Encrypt
and the container registry.

---

## 4. Provision the machine

```bash
ssh -i ~/.ssh/<your-key> ubuntu@<public-ip>
```

Then, from the repository checkout:

```bash
sudo bash deploy/vm-setup.sh
```

The script is idempotent, so it is safe to re-run after a failure or to add
steps later. It:

- checks it is running as root on Ubuntu, and warns if the architecture is not `aarch64`
- installs `curl` and `openssl` if they are missing
- creates a **4 GB** swap file (`/swapfile`) with a single `/etc/fstab` entry, giving the Angular build headroom on 2 OCPUs
- installs Docker Engine from the official script
- installs the **Docker Compose v2** plugin, verified against the published SHA256
- configures UFW for 22, 80, 443/TCP and 443/UDP
- creates `deploy/caddy-data` and `deploy/caddy-config`
- generates `deploy/.env` with random secrets if it does not already exist — **existing secrets are never overwritten**
- runs `docker compose config -q` as a final gate

Compose is installed as a separate step because neither the Oracle image nor a
default Docker install ships it, and every command in this guide uses
`docker compose`.

Prefer to do it by hand? The script is short and readable enough to follow.

---

## 5. Configure the deployment

Copy the repository to `/opt/eventia` — or wherever you cloned it, keeping it in
sync with the script's `APP_DIR` — and create the environment file:

```bash
cd /opt/eventia
cp deploy/.env.example deploy/.env
chmod 600 deploy/.env
nano deploy/.env
```

Fill in every value:

```bash
PUBLIC_SITE_ADDRESS=https://203.0.113.10    # your VM's public IP
PUBLIC_ORIGIN=https://203.0.113.10
ACME_EMAIL=you@example.com                   # a real mailbox, for expiry notices

POSTGRES_PASSWORD=<output of: openssl rand -hex 32>
JWT_ACCESS_SECRET=<output of: openssl rand -hex 32>
JWT_REFRESH_SECRET=<output of: openssl rand -hex 32>

SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=<a strong password>
```

`PUBLIC_SITE_ADDRESS` and `PUBLIC_ORIGIN` hold the same value today, but they
serve different purposes: the first is Caddy's TLS site address, the second
becomes `CORS_ORIGINS` and `FRONTEND_URL` on the backend. Keeping them separate
means a future certificate change cannot silently break CORS.

**`TRUST_PROXY_HOPS=1` is correct for this topology** — exactly one proxy in
front of the app. Raising it would let clients spoof `X-Forwarded-For`.

`deploy/.env` is git-ignored. `deploy/.env.example` is the tracked template.

---

## 6. Build and start

```bash
cd /opt/eventia
docker compose --env-file deploy/.env up -d --build
```

`--env-file deploy/.env` is required on every command in this guide: Compose
reads `.env` from the project root, not from `deploy/`.

**The first build takes several minutes** on 2 OCPUs, because both images
compile from source natively on ARM64. Later builds reuse the layer cache. If
you interrupt it, run the same command again.

The build context is only about 8 MB: `.dockerignore` excludes `node_modules`,
`dist`, coverage output, every `.env` file, and Caddy's runtime directories.
Nothing is compiled on the host first — both images build `shared` internally,
so a clean clone with no local `node_modules` builds correctly.

Watch the stack come up:

```bash
docker compose --env-file deploy/.env ps
```

`migrate` and `frontend-assets` showing `Exited (0)` is success. `backend`
should reach `healthy`, after which Caddy starts.

Follow certificate issuance:

```bash
docker compose --env-file deploy/.env logs -f caddy
```

You want to see `certificate obtained successfully`. The first ACME request can
take up to a minute.

---

## 7. Create the first administrator

A fresh production database has no users at all. Register yourself, then promote
the account:

```bash
IP=203.0.113.10

curl -fsS -X POST https://$IP/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Admin","email":"admin@example.com","password":"YOUR_PASSWORD"}'

docker compose --env-file deploy/.env exec -T postgres \
  psql -U eventia -d eventia \
  -c "UPDATE users SET role='admin' WHERE email='admin@example.com';"
```

Then confirm the promotion worked:

```bash
docker compose --env-file deploy/.env exec -T postgres \
  psql -U eventia -d eventia \
  -c "SELECT email, role FROM users WHERE email='admin@example.com';"
```

Self-registration cannot escalate. `RegisterDto` has no `role` field, and the
global `ValidationPipe` runs with `forbidNonWhitelisted`.

### Optional: load demo data instead

To get the 14 demo events, categories, venues and seat layouts:

```bash
docker compose --env-file deploy/.env run --rm \
  -e SEED_ADMIN_EMAIL=admin@example.com \
  -e SEED_ADMIN_PASSWORD='YOUR_PASSWORD' \
  --entrypoint node backend dist/seed.js
```

> The demo seed also creates five customer accounts with passwords published in
> `backend/src/seed-data.ts` (`alice@example.com` / `alicepass123`, and four more
> like it). On a publicly reachable deployment, either delete those accounts
> straight afterwards or keep the instance closed until you have.

`SEED_ALLOW_DESTRUCTIVE` stays `false` in production, so the seed's fixture
cleanup is skipped and your real data is never touched.

---

## 8. Verify the deployment

Every command in this section has been run against this exact stack.

```bash
IP=203.0.113.10

# API up and database reachable
curl -fsS https://$IP/api/v1/health
# {"status":"ok","database":"up",...}

# SPA root
curl -fsS -o /dev/null -w '%{http_code}\n' https://$IP/
# 200

# deep link — this is what proves the SPA fallback works
curl -fsS -o /dev/null -w '%{http_code}\n' https://$IP/events
# 200

# an API 404 must be JSON, not the SPA shell
curl -s https://$IP/api/v1/nope
# {"statusCode":404,"code":"NOT_FOUND","errors":["Route not found"],...}

# the certificate is trusted and issued for the IP
# -servername matters: without SNI, Caddy has nothing to select a certificate by
echo | openssl s_client -connect $IP:443 -servername $IP 2>/dev/null \
  | openssl x509 -noout -dates

# Swagger is disabled in production
curl -s -o /dev/null -w '%{http_code}\n' https://$IP/api/docs
# 404
```

Then in a browser: open `https://$IP`, browse events, add a ticket to the cart,
register, and check out. As an admin, upload a cover image — that one action
exercises the `uploads` volume, `trust proxy` and the `/uploads` route together.
The stored URL must start with `https://`, and the image must render; a stored
`http://` URL means the forwarded-protocol handling has been broken.

Two route details worth knowing while testing by hand:

- event creation is `POST /api/v1/events`, not `POST /api/v1/admin/events`
- the current user is `GET /api/v1/users/me`, not `/auth/me`

---

## 9. Day-to-day operations

All commands run from the repository root, and all need `--env-file deploy/.env`.

```bash
# status
docker compose --env-file deploy/.env ps

# logs — add a service to narrow it: ... logs -f backend
docker compose --env-file deploy/.env logs -f

# restart just the API
docker compose --env-file deploy/.env restart backend

# stop / start; data survives both
docker compose --env-file deploy/.env down
docker compose --env-file deploy/.env up -d

# shell into the API container
docker compose --env-file deploy/.env exec backend sh

# SQL console
docker compose --env-file deploy/.env exec postgres psql -U eventia -d eventia

# apply new migrations on their own
docker compose --env-file deploy/.env run --rm migrate

# inspect the certificate Caddy is serving
docker compose --env-file deploy/.env exec caddy ls /data/caddy/certificates
```

Restarting `backend` does not interrupt Caddy: the proxy keeps serving static
files and returns `502` only for API calls during the gap.

---

## 10. Backups and restore

Both commands have been run against this deployment.

```bash
# dump
docker compose --env-file deploy/.env exec -T postgres \
  pg_dump -U eventia -d eventia > backup-$(date +%F).sql

# restore
docker compose --env-file deploy/.env exec -T postgres \
  psql -U eventia -d eventia < backup-2026-10-01.sql
```

Back up the `uploads` volume too — the database stores only the path to each
image, not the image itself:

```bash
docker run --rm -v eventia_uploads:/data -v "$PWD:/out" alpine \
  tar czf /out/uploads-$(date +%F).tar.gz -C /data .
```

---

## 11. Updating the deployment

```bash
cd /opt/eventia
git pull
docker compose --env-file deploy/.env up -d --build
```

`migrate` runs again automatically before `backend` starts, so schema changes
ship with the update. `frontend-assets` re-copies the new bundle into the
`frontend_www` volume, so the SPA picks up new assets without a manual step.

Uploaded images and the database are untouched by this. If a migration breaks,
`down -v` is the last resort and it destroys both volumes — take a backup first.

---

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `certificate obtained successfully` never appears | Port 80 closed in the VCN security list, or `PUBLIC_SITE_ADDRESS` is not the instance's real IP | Recheck step 3 and `deploy/.env`; `docker compose --env-file deploy/.env logs caddy` shows the ACME error |
| Browser warns the certificate is untrusted | Issuance has not finished yet | Wait a minute and reload; `logs caddy` will say if it failed permanently |
| SPA 404s on refresh (`/events` fails, `/` works) | `frontend_assets` volume is empty | `docker compose --env-file deploy/.env run --rm frontend-assets` then restart Caddy |
| `backend` restarts repeatedly | Migrations failed, so the schema is wrong | `docker compose --env-file deploy/.env logs migrate` — the failing query is the last line |
| `required variable POSTGRES_PASSWORD is missing` | `--env-file` omitted | Add `--env-file deploy/.env` to the command |
| `unresolved placeholders left in .../deploy/.env` | Values were not filled in | Edit the file; the script prints the offending line numbers |
| Uploaded covers are broken in the browser | Stored URL came back as `http://` | Confirm Caddy sits in front of `backend` and `TRUST_PROXY_HOPS=1` |
| Login works, then the session drops | Browser is blocking the refresh cookie | Confirm you are on `https://` and the API is same-site with the SPA |
| `docker compose` is an unknown command | Compose plugin not installed | Re-run `sudo bash deploy/vm-setup.sh` |
| Site is slow, or the build is killed | Not enough memory for the Angular build | Confirm `/swapfile` exists: `swapon --show` |
| No HTTP/3 | UDP 443 blocked | Add the UDP ingress rule from step 3 |

If the site is up but Caddy serves its own error page, check
`docker compose --env-file deploy/.env logs caddy` first — the cause is almost
always in there.

---

## 13. What has and has not been verified

Verified against a running stack on this machine:

- all 7 migrations apply through the compiled `dist` path, and re-running is a no-op
- both images build; the backend image contains production dependencies only
- `docker compose up -d` converges in the right order, and `migrate` exits `0`
- the backend reaches `healthy` and answers `/api/v1/health`
- SPA root, hashed assets, and deep links all return `200`
- API requests are proxied, and API errors stay JSON instead of falling through to the SPA shell
- `/uploads` serves images from the shared volume, mounted read-only to Caddy
- an image uploaded through Caddy is stored as an `https://` URL and is fetchable at that URL
- HTTP→HTTPS redirect, HSTS, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, and zstd compression
- admin promotion via SQL, and RBAC: a customer token gets `403` from `/admin/stats`
- `pg_dump` and `psql` restore into a scratch database
- the `uploads` volume survives `restart` and `down`/`up`
- `deploy/.env.example` is accepted by `docker compose config` as-is
- `vm-setup.sh` passes `bash -n` and shellcheck; its guards, swap setup, secret generation and checksum verification were each exercised

Not verified, because it needs the real VM:

- **actual Let's Encrypt issuance** for an IP address. Routing was proven with Caddy's internal CA; only a routable public IP proves the ACME flow.
- **native ARM64 builds.** Everything here was built on amd64. The ARM path rests on the bcrypt `linux-arm64` prebuild and the confirmed `arm64` image manifests, not on an ARM build.
- **Oracle Always Free provisioning**, VCN rules, and any idle-reclamation behaviour.

Treat the first `docker compose up -d --build` as the real test of the ARM build.
