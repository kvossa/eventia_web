# Eventia

A Ticketmaster-style ticketing platform: visitors discover events, pick ticket types
(or seats), add them to a cart and complete a **simulated** purchase; customers get digital
tickets with self-contained QR codes; administrators manage events, venues, ticket types,
orders and users.

Payments are always simulated — no real money is ever processed.

| Tier      | Technology                                              |
| --------- | ------------------------------------------------------- |
| Backend   | NestJS 12 (Node 26, TypeScript, ESM)                     |
| Frontend  | Angular 22 (standalone components, signals)              |
| Database  | PostgreSQL 17 (Docker container `eventia-postgres`)     |
| ORM       | TypeORM 1.x (migrations only, `synchronize` is false)   |
| Auth      | JWT access + rotating refresh tokens, bcrypt, RBAC      |
| Payments  | Simulated provider                                      |
| Monorepo  | pnpm workspaces (`backend`, `frontend`, `shared`)        |

## Repository layout

```
eventia/
├─ package.json          # workspace scripts (build, migrate, seed, dev:*)
├─ pnpm-workspace.yaml
├─ backend/              # NestJS API — /api/v1 prefix, Swagger at /api/docs
├─ frontend/             # Angular SPA
├─ shared/               # @eventia/shared — shared types/enums (built to dist/)
├─ compose.yml           # full stack: postgres, migrate, backend, frontend, caddy
├─ Caddyfile             # TLS + reverse proxy (HTTPS, ACME IP certificates)
└─ deploy/               # production deployment guide and VM bootstrap script
```

All money values are **integer cents** (`priceCents`, `totalCents`, …) across every layer.

## Prerequisites

- Node.js 26, pnpm 10. Node 26 no longer ships Corepack, so install pnpm once with
  `npm install -g pnpm@10.33.4` (see `.nvmrc` for the pinned Node version).
- Docker (for PostgreSQL)

## Quick start

```bash
# 1. database
docker run -d --name eventia-postgres \
  -e POSTGRES_USER=eventia -e POSTGRES_PASSWORD=eventia -e POSTGRES_DB=eventia \
  -p 5432:5432 postgres:17

# 2. dependencies + shared package + env
pnpm install
pnpm build:shared
cp backend/.env.example backend/.env   # then edit secrets/passwords

# 3. schema + demo data
pnpm migrate
pnpm seed

# 4. run (two terminals)
pnpm dev:backend     # API on :3000, Swagger on :3000/api/docs
pnpm dev:frontend    # SPA on :4200
```

The seed is idempotent: re-running it never duplicates data and it also removes throwaway
e2e fixtures (`E2E *` records and throwaway `…@example.com` users plus their orders and carts).
Real user data — including your own orders — is never touched by the default run.

Two seed modes exist:

| Command            | What it does                                                                          |
| ------------------ | ------------------------------------------------------------------------------------- |
| `pnpm seed`        | Safe default: adds/keeps demo data, cleans only throwaway e2e fixtures                 |
| `pnpm seed:purge`  | Full demo reset: also drops every order, cart, favorite and notification, and restores seeded ticket stock |

`pnpm seed:purge` is the one to reach for when you want the catalog back at its
seeded state after buying demo tickets by hand.

### Seeded accounts

| Role     | Email                  | Password        |
| -------- | ---------------------- | --------------- |
| Admin    | `root@eventia.local`   | `adminpass1234` |
| Customer | `alice@example.com`    | `alicepass123`  |
| Customer | `sam@example.com`      | `sampass123`    |
| Customer | `mia@example.com`      | `miapass123`    |
| Customer | `kai@example.com`      | `kaipass123`    |
| Customer | `nina@example.com`     | `ninapass123`   |

## Scripts

Run from the workspace root unless noted.

| Command             | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `pnpm build`        | Build `@eventia/shared` then the backend                   |
| `pnpm build:shared` | Build `@eventia/shared` only                               |
| `pnpm migrate`      | Run TypeORM migrations                                     |
| `pnpm seed`         | Idempotent demo data + e2e fixture cleanup (safe default)   |
| `pnpm seed:purge`   | Full demo reset (orders/carts/notifications + stock)       |
| `pnpm lint`         | oxlint (backend) + eslint (frontend)                       |
| `pnpm dev:backend`  | Backend in watch mode (`:3000`)                            |
| `pnpm dev:frontend` | Angular dev server (`:4200`)                               |
| `pnpm -C backend lint`     | oxlint over `src/` and `test/`                     |
| `pnpm -C backend test`     | Backend unit tests (vitest)                       |
| `pnpm -C backend test:e2e` | Backend e2e tests (vitest, needs a running DB)  |
| `pnpm -C backend test:cov`     | Unit tests with V8 coverage (`backend/coverage`)         |
| `pnpm -C backend test:cov:e2e` | E2e tests with V8 coverage (`backend/coverage-e2e`)     |
| `pnpm -C frontend lint`       | ESLint (Angular + TypeScript + a11y templates)          |
| `pnpm -C frontend test`    | Frontend tests (vitest + jsdom)                   |
| `pnpm -C frontend build`   | Production Angular build                         |

Generate a migration after changing an entity (positional path — `--name=` is unsupported):

```bash
pnpm -C backend migration:generate src/migrations/AddThing
```

Fresh schema from scratch:

```sql
DROP SCHEMA public CASCADE; CREATE SCHEMA public;
```

then remove `backend/src/migrations/*.ts`, regenerate and re-run `pnpm migrate`.

## Configuration

Backend env vars live in `backend/.env` (see `.env.example`): `PORT`, `DB_*`, `JWT_*`,
`CORS_ORIGINS`, `COOKIE_SECURE`, `THROTTLE_*` and `UPLOAD_DIR`.
The Angular dev server talks to `http://localhost:3000/api/v1` (`frontend/src/app/core/env.ts`);
production builds use the relative `/api/v1` so the SPA and API share one origin
(`frontend/src/app/core/env.prod.ts`).

## Deployment

`compose.yml` runs the whole stack — PostgreSQL, migrations, API, built Angular assets and
Caddy for HTTPS. It expects a single public origin, because the refresh cookie is same-site.

```bash
cp deploy/.env.example deploy/.env   # set the IP, secrets and admin credentials
docker compose --env-file deploy/.env up -d --build
```

`deploy/README.md` is the full guide: Oracle Always Free VM provisioning (A1.Flex, Ubuntu
24.04 ARM64), VCN and UFW rules, a repeatable bootstrap script (`deploy/vm-setup.sh`),
first-admin setup, backups, updates and troubleshooting.

## Event images

Admins upload a cover image per event; files are stored on disk (git-ignored `uploads/`) and
served as static assets:

- `POST /api/v1/admin/events/:id/image` — multipart field `file`
- PNG, JPEG, WebP or GIF, max 2 MB (larger files return `413`)
- Stored under `UPLOAD_DIR/events/<uuid>.<ext>`, the returned `imageUrl` is absolute and stored
  on the event, files are served from `/uploads/…`

## API surface

Swagger UI: `http://localhost:3000/api/docs`. Highlights:

- **Auth** — `POST /auth/register|login|refresh|logout` (access token in the body, refresh token
  in an httpOnly cookie, rotation on refresh)
- **Discovery** — `GET /events` with `q`, `category`, `city`, `dateFrom`, `dateTo`, `priceMin`,
  `priceMax`, `page`, `limit`; `GET /events/:id` with live availability
- **Cart** — cookie-scoped anonymous cart, merged into the user's cart on login
- **Checkout** — `POST /checkout` with an `idempotencyKey`, transactional, simulated payment
- **Account** — `/orders`, `/tickets` (`?scope=upcoming|past|all`, self-contained QR payloads),
  `/favorites`, `/notifications`, profile & settings
- **Admin** — `/admin/dashboard`, `/admin/events` (publish/unpublish/mark-sold-out),
  `/admin/events/:id/image`, `/admin/ticket-types`, `/admin/venues`, `/admin/venue-layout`,
  `/admin/organizers`, `/admin/categories`, `/admin/orders` (status changes, refunds),
  `/admin/users`

## Testing notes

- Backend unit specs are colocated with sources (`backend/src/**/*.spec.ts`) and need no DB.
- Backend e2e specs live in `backend/test/*.e2e-spec.ts` and run against the real database, so
  they need migrations applied and the seeded admin account.
- Frontend specs are colocated next to their pages/components and run in jsdom.

## Conventions

- Migrations only — never enable `synchronize`.
- Money is integer cents.
- Soft deletes (`deletedAt`) on users, organizers, venues and events.
- Checkout runs in a single DB transaction and is idempotent.
- Global `ValidationPipe` with whitelist + `forbidNonWhitelisted`, consistent error envelope,
  paginated lists.
