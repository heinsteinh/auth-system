# auth-system

[![CI](https://github.com/heinsteinh/auth-system/actions/workflows/ci.yml/badge.svg)](https://github.com/heinsteinh/auth-system/actions/workflows/ci.yml)

A learning project for building a **production-grade authentication system** end-to-end. The goal isn't just "make login work" — it's to practice the boring, important things that real services need: secure token handling, schema migrations, observability, rate limiting, email flows, and a sensible deployment story.

## What we're learning

This repo is a sandbox for picking up production patterns one at a time. Concretely:

- **Auth fundamentals** — bcrypt password hashing, JWT access tokens (in-memory on the client), opaque refresh tokens stored hashed in the DB and held by the browser as an `HttpOnly; SameSite=Lax; Path=/api/auth` cookie, refresh-token rotation/revocation, role-based access control (`USER` / `ADMIN`).
- **Email-driven flows** — email verification on signup, password reset with single-use tokens, all delivered via SMTP (MailHog locally).
- **Schema-first data modeling** — Prisma 7 with the new `prisma-client` generator and a Postgres driver adapter (`@prisma/adapter-pg`), versioned migrations, enums in the schema (not ad-hoc strings).
- **Hardening basics** — rate limiting on auth endpoints, env validation with Zod (fail fast at boot), CORS scoped to a known frontend origin, cookies with sane defaults.
- **Observability** — Fastify's built-in logger, a `/health` endpoint that actually pings the DB so liveness/readiness probes mean something.
- **Modern TypeScript ESM** — `"type": "module"` + `NodeNext` module resolution, explicit `.js` extensions in source imports, no transpiler tricks.
- **Local infra parity** — Postgres, Redis, and MailHog wired up via `docker-compose` so the dev environment matches production shape.
- **Frontend integration** — a Vite + React + Tailwind v4 client in `frontend/` that exercises the real auth flows (login, register, refresh-on-401, role-gated admin).

The point is to make the mistakes that real services make, in a small enough codebase that we can fix them properly.

## Stack

| Layer        | Choice                                                           |
| ------------ | ---------------------------------------------------------------- |
| Runtime      | Node.js (ESM)                                                    |
| Framework    | [Fastify 5](https://fastify.dev/)                                |
| ORM          | [Prisma 7](https://www.prisma.io/) (`prisma-client` generator)   |
| Database     | PostgreSQL 16                                                    |
| Cache/queue  | Redis 7                                                          |
| Mail (dev)   | [MailHog](https://github.com/mailhog/MailHog)                    |
| Validation   | [Zod 4](https://zod.dev/)                                        |
| Auth tokens  | `jsonwebtoken` (access), hashed random tokens (refresh / email)  |
| Hashing      | `bcrypt`                                                         |
| Package mgr  | `pnpm` 10                                                        |

## Layout

```
auth-system/
├── api/                  # Fastify backend (this is where most of the action is)
│   ├── prisma/           # schema.prisma + migrations
│   ├── tests/            # vitest: unit, integration, e2e
│   └── src/
│       ├── config/       # env loading + validation
│       ├── modules/      # feature slices (auth, users, ...)
│       ├── plugins/      # Fastify plugins (prisma, jwt, rate-limit)
│       ├── security/     # password hashing, token utils, route guards
│       └── mail/         # transactional emails
├── frontend/             # Vite + React + TS client (Tailwind v4, react-router)
│   └── src/
│       ├── auth/         # AuthProvider, ProtectedRoute, axios client
│       └── pages/        # Login, Register, Dashboards, Forgot/Reset password
└── docker-compose.yml    # postgres + redis + mailhog
```

## Getting started

Prereqs: Node 20+, pnpm 10, Docker.

### 1. Bring up infrastructure (Postgres, Redis, MailHog)

```bash
docker compose up -d
```

### 2. Run the API

```bash
cd api
cp .env.example .env       # then fill in secrets, DATABASE_URL, etc.
                           # see "Generating JWT secrets" below
pnpm install
pnpm prisma migrate dev    # apply migrations
pnpm prisma generate       # (re)generate the Prisma client
pnpm dev                   # tsx watch — listens on http://localhost:4000
```

### 3. Run the frontend (in a second terminal)

```bash
cd frontend
pnpm install
pnpm dev                   # vite — listens on http://localhost:5173
```

The frontend reads `VITE_API_URL` from `frontend/.env` (defaults to `http://localhost:4000`). Make sure `FRONTEND_URL=http://localhost:5173` is set in `api/.env` so CORS lets it through.

### 4. Tests

```bash
cd api
pnpm test                  # full vitest suite (unit + integration + e2e)
pnpm test:unit             # unit tests only — no DB
pnpm test:integration      # integration tests — needs Postgres up
pnpm test:e2e              # boots a real HTTP server
pnpm test:coverage         # v8 coverage
```

The first run auto-creates the `auth_test` database and applies migrations.

### Useful URLs

- API: http://localhost:4000
- Frontend: http://localhost:5173
- MailHog UI: http://localhost:8025
- Health check: `curl http://localhost:4000/health` → `{ status: "ok", db: "up" }`

### Bootstrapping an admin

The frontend's `/admin` route is gated to `role = ADMIN`. Newly registered users are `USER`. There are two paths to get an admin into the system:

**Seed the first admin (recommended).** Set in `api/.env`:

```
ADMIN_EMAIL="you@example.com"
ADMIN_PASSWORD="ChangeMeStrong123!"
ADMIN_NAME="You"
```

Then from `api/`:

```bash
pnpm seed
```

This is idempotent — running it again updates the password for that email. The seeded user is created with `isEmailVerified = true` so you can log in immediately.

**Promote others from the UI.** Once any admin is signed in, the **Admin** page (`/admin`) shows a `Promote` / `Demote` button next to each user. The endpoint is `PATCH /api/users/admin/users/:id` with `{ "role": "ADMIN" | "USER" }`. An admin cannot change their own role (server-side guard, so you can't accidentally lock yourself out from the UI).

**Fallback (manual SQL).** If the seed step isn't an option:

```bash
docker compose exec postgres psql -U auth_user -d auth_db \
  -c "UPDATE \"User\" SET role = 'ADMIN' WHERE email = 'you@example.com';"
```

## Generating JWT secrets

`JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` must each be **at least 32 characters** (enforced by the Zod env schema in `api/src/config/env.ts`). Don't reuse the same value for both — rotating one shouldn't invalidate the other.

Generate a fresh secret with `openssl`:

```bash
openssl rand -base64 48 | tr -d '\n/+=' | cut -c1-48
```

That gives a 48-character URL-safe string (no `/`, `+`, or `=` to mangle `.env` quoting). Run it twice and drop the results into `api/.env`:

```
JWT_ACCESS_SECRET="<paste first value>"
JWT_REFRESH_SECRET="<paste second value>"
```

Rules of thumb:
- **Per environment, per secret.** Dev, staging, and prod each get their own pair. Never copy prod secrets into dev.
- **Never commit them.** `api/.env` is gitignored — keep it that way. For prod, use your platform's secret manager (Doppler, AWS SSM, Vault, etc.).
- **Rotate when leaked.** Rotating `JWT_ACCESS_SECRET` invalidates outstanding access tokens (15 min blast radius). Rotating `JWT_REFRESH_SECRET` forces every session to re-authenticate.

## Trying it out

A `request.http` file at the repo root walks through the full auth flow. It's designed for the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) VS Code extension — open the file and click **Send Request** above each block.

The flow is sequential and tokens are wired automatically (login response → `{{accessToken}}` for protected calls, refresh response → rotated tokens):

1. `GET /health` — API + DB liveness
2. `POST /api/auth/register` → check MailHog at http://localhost:8025 for the verification email
3. `GET /api/auth/verify-email?token=…` — paste token from MailHog
4. `POST /api/auth/login` — captured into `{{accessToken}}` / `{{refreshToken}}`
5. `GET /api/users/me` — protected route using the captured access token
6. `POST /api/auth/refresh` — token rotation + re-test `/me` with the new pair
7. `POST /api/auth/forgot-password` → `POST /api/auth/reset-password` — full reset flow via MailHog
8. Admin-only routes — `/api/users/admin/users` list + delete (requires a user with `role = ADMIN`)
9. Negative paths — wrong password (401), missing/garbage token (401), duplicate register (409) — useful for verifying guards actually fire

Prefer curl? The same calls translate directly; the REST Client format is just nicer for capturing the token between steps.

## Status

Early. The API has the auth surface (register, login, refresh, logout, verify email, password reset) and an admin user-management slice. Web client and CI are still to come. Expect breaking changes — this is a learning repo, not a library.
