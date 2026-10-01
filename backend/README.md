# Eventia — backend

NestJS 12 API for Eventia (see the [root README](../README.md) for the full stack overview,
demo accounts and setup flow). The API is served under `/api/v1`, Swagger UI lives at
`/api/docs`, and static event images are served from `/uploads`.

## Commands

```bash
pnpm start:dev          # watch mode on :3000
pnpm build              # nest build
pnpm lint               # oxlint src/ test/
pnpm test               # unit tests (vitest, no DB required)
pnpm test:e2e           # e2e tests (vitest, needs PostgreSQL + migrations + seed)
pnpm test:cov           # unit tests + V8 coverage -> coverage/ (enforced thresholds)
pnpm test:cov:e2e       # e2e tests + V8 coverage -> coverage-e2e/ (enforced thresholds)
pnpm seed               # tsx src/seed.ts (idempotent demo data + e2e fixture cleanup)
pnpm seed -- --purge    # full demo reset: also drops orders/carts/notifications + restores stock
                        # (same thing as `pnpm seed:purge` from the workspace root)
pnpm migration:run      # apply migrations
pnpm migration:generate src/migrations/AddThing   # positional path; --name= is unsupported
```

## Layout

```
src/
├─ admin/            # dashboard aggregations
├─ auth/             # JWT access + rotating refresh tokens, guards
├─ cart/             # cookie cart, merge on login
├─ categories/       # admin CRUD
├─ checkout/         # transactional, idempotent order placement
├─ common/           # filters, interceptors, upload helpers
├─ config/           # data-source (TypeORM CLI entry point)
├─ entities/         # TypeORM entities
├─ events/           # public search/detail + admin CRUD, image upload
├─ orders/           # customer + admin orders, refunds
├─ organizers/       # admin CRUD
├─ tickets/          # customer tickets, QR payloads
├─ venues/           # admin CRUD + seat-map layout
├─ migrations/       # TypeORM migrations (never use synchronize)
├─ seed.ts           # demo data entry point
└─ seed-data.ts      # demo fixtures
test/                # e2e specs + test-app helper
```

## Environment

Copy `.env.example` to `.env` and adjust:

| Variable | Notes |
| --- | --- |
| `PORT` | API port, default `3000` |
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` | PostgreSQL connection; `DB_SYNC` must stay `false` |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Change before any non-local use |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` / `JWT_ISSUER` | Token lifetimes |
| `CORS_ORIGINS` | Comma-separated allowed origins |
| `COOKIE_SECURE` | Set `true` behind HTTPS |
| `UPLOAD_DIR` | Event image root, default `uploads` (relative to the backend cwd) |
| `THROTTLE_TTL_MS` / `THROTTLE_LIMIT` | Rate limiting |

## Event image upload

`POST /api/v1/admin/events/:id/image` (admin only) accepts a single `multipart/form-data`
field named `file`:

- allowed types: PNG, JPEG, WebP, GIF — anything else returns `400`
- max size 2 MB — larger files return `413`
- stored as `UPLOAD_DIR/events/<uuid>.<ext>`; the file is removed again if persisting fails
- the response is the updated event with an absolute `imageUrl` (e.g.
  `http://localhost:3000/uploads/events/<uuid>.png`)

## Testing notes

- Unit specs are colocated (`src/**/*.spec.ts`) and mock TypeORM repositories; the exception is
  `src/seed-data.spec.ts`, which needs no mocks because it asserts seed-data invariants
  (section bindings resolve, per-section allocation <= seat count, `quantitySold <= quantity`,
  `HH:MM` times).
- `test/seed-seat-layout.e2e-spec.ts` is read-only: it asserts the seeded reserved-seat layouts through
  the public seat-map endpoint, so it creates no fixtures and needs no cleanup.
- E2e specs (`test/*.e2e-spec.ts`) boot the real `AppModule` against PostgreSQL; they need
  migrations applied and the seeded admin (`root@eventia.local` / `adminpass1234`).
- E2e fixtures use time-stamped slugs and emails, and `pnpm seed` removes them afterwards.
- Coverage is reported separately per suite and both runs **fail** if thresholds are missed.
  The e2e run is the meaningful figure (~82.5% statements / ~86.5% lines, gate at 80/60/84/84)
  because unit specs only exercise pure helpers — the unit floor (8/5/5/8) exists only to catch
  a catastrophic drop, not to describe real coverage.
- `pnpm seed` is the safe default and never deletes real orders. `--purge` is the explicit
  full-reset escape hatch.
