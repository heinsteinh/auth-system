# auth-system

A learning project for building a **production-grade authentication system** end-to-end. The goal isn't just "make login work" — it's to practice the boring, important things that real services need: secure token handling, schema migrations, observability, rate limiting, email flows, and a sensible deployment story.

## What we're learning

This repo is a sandbox for picking up production patterns one at a time. Concretely:

- **Auth fundamentals** — bcrypt password hashing, JWT access tokens + opaque refresh tokens stored hashed, refresh-token rotation/revocation, role-based access control (`USER` / `ADMIN`).
- **Email-driven flows** — email verification on signup, password reset with single-use tokens, all delivered via SMTP (MailHog locally).
- **Schema-first data modeling** — Prisma 7 with the new `prisma-client` generator and a Postgres driver adapter (`@prisma/adapter-pg`), versioned migrations, enums in the schema (not ad-hoc strings).
- **Hardening basics** — rate limiting on auth endpoints, env validation with Zod (fail fast at boot), CORS scoped to a known frontend origin, cookies with sane defaults.
- **Observability** — Fastify's built-in logger, a `/health` endpoint that actually pings the DB so liveness/readiness probes mean something.
- **Modern TypeScript ESM** — `"type": "module"` + `NodeNext` module resolution, explicit `.js` extensions in source imports, no transpiler tricks.
- **Local infra parity** — Postgres, Redis, and MailHog wired up via `docker-compose` so the dev environment matches production shape.
- **Frontend integration** *(coming)* — a small web client in `web/` to exercise the real auth flows end-to-end.

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
│   └── src/
│       ├── config/       # env loading + validation
│       ├── modules/      # feature slices (auth, users, ...)
│       ├── plugins/      # Fastify plugins (prisma, jwt, rate-limit)
│       ├── security/     # password hashing, token utils, route guards
│       └── mail/         # transactional emails
├── web/                  # frontend client (placeholder)
└── docker-compose.yml    # postgres + redis + mailhog
```

## Getting started

Prereqs: Node 20+, pnpm 10, Docker.

```bash
# 1. Bring up Postgres, Redis, MailHog
docker compose up -d

# 2. Configure the API
cd api
cp .env.example .env       # then fill in secrets, DATABASE_URL, etc.
pnpm install

# 3. Apply migrations + generate Prisma client
pnpm prisma migrate dev
pnpm prisma generate

# 4. Run it
pnpm dev                   # tsx watch
```

Health check: `curl http://localhost:4000/health` — returns `{ status: "ok", db: "up" }` when Postgres is reachable, `503` otherwise.
MailHog UI: http://localhost:8025

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
