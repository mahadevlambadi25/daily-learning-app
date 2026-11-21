# Daylight: Personalised Daily Learning (MVP)

A mobile-first web app / installable PWA where learners choose 1–5 topics, get a short personalised set of lessons every day, read or listen to them, and save or complete them. Editors manage content through an admin CMS with a review → schedule → publish workflow.

Built to the *Personalised Daily Learning App PRD v1.0*. The working title "Daylight" is configurable with `NEXT_PUBLIC_APP_NAME`.

## Quick start

```bash
npm install
cp .env.example .env          # then edit values
npx prisma migrate deploy     # create the SQLite dev database (prisma/dev.db)
npm run db:seed               # 50 topics + 60 starter lessons + admin account from .env
npm run dev                   # http://localhost:3000
```

Sign in as the admin with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` and open `/admin`.

> npm 11 may block install scripts. If Prisma or esbuild complain, run
> `npm approve-scripts prisma @prisma/engines @prisma/client esbuild` and `npm rebuild`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / production server |
| `npm test` | Unit + integration tests (Vitest) against a throwaway `prisma/test.db` |
| `npm run test:smoke` | 66 end-to-end HTTP checks against a running server (`BASE_URL`, default `http://localhost:3000`) |
| `npx tsx scripts/qa-screens.ts` | Screenshots every core screen at 360px and 1280px with local Edge, fails on horizontal overflow, and regenerates PWA PNG icons |
| `npx tsx scripts/qa-push.ts` | Real-browser push check: subscribes Edge through its push service and sends a test reminder via the server (`HEADED=1` to watch) |
| `npm run db:seed` | Idempotent seed: topics, starter lessons, admin |
| `npm run content:validate` | Checks seed lesson JSON against the editorial standard (PRD §8) |
| `npm run content:check-links` | Checks every seed source URL responds; flags sites that block automated checks for a manual look |
| `npm run admin:create -- you@example.com` | Grants admin to an existing account (no public admin sign-up) |
| `npm run job:daily` | Runs the daily delivery job once, locally |
| `npm run typecheck` | TypeScript check |

## Architecture

```
Browser ──► Next.js 15 App Router (React 19, Tailwind v4)
              ├─ middleware.ts         edge guard: login redirect + same-origin check on API writes
              ├─ app/**/page.tsx       server components call services directly
              ├─ app/api/**/route.ts   REST API, { data, error, meta } envelope (PRD §14)
              └─ server/*              domain services (feed, lessons, users, admin, email, jobs)
                     └─ Prisma ──► SQLite (dev) / PostgreSQL (prod)
Cron (every 15 min) ──► POST /api/jobs/daily-delivery ──► assign lessons ──► email provider
Browser SpeechSynthesis reads lessons aloud on demand (no audio pipeline)
```

| PRD recommendation | This build | Why |
| --- | --- | --- |
| Supabase Auth | Own email/password auth: bcrypt hashes, DB-backed sessions in HTTP-only `SameSite=Lax` cookies, password reset by emailed single-use token | Runs locally with no cloud account. Can be swapped for Supabase Auth later. |
| Supabase Postgres + RLS | Prisma with SQLite locally; switch `provider` to `postgresql` for production | Same schema and migrations. Isolation is enforced in the service layer (every query scoped to the session user) and covered by tests. Add Postgres RLS policies as defence-in-depth when moving to Supabase. |
| Resend / Postmark | Provider abstraction: `console` (dev), `resend` (prod), `memory` (tests) | |
| Scheduled functions | `vercel.json` cron calls the job route every 15 min with `Authorization: Bearer $CRON_SECRET` | Vercel Hobby only allows daily crons. On Hobby, use any external cron (GitHub Actions, cron-job.org) to POST every 15 minutes. |
| PostHog / Plausible | First-party `AnalyticsEvent` table + admin Overview dashboard | Forward from `server/analytics.ts` later if needed. |

### Key folders

- `prisma/schema.prisma`: data model (PRD §13); `prisma/migrations`: SQL migrations
- `prisma/data/topics.ts`: the 50-topic catalogue and featured ranking
- `prisma/seed-content/*.json`: 60 starter lessons (one per topic, two for each featured topic)
- `src/server/feed.ts`: daily assignment rules; `src/server/jobs/daily-delivery.ts`: scheduled job
- `src/lib/lesson-workflow.ts`: status machine + publish checklist; `src/lib/validation.ts`: all input schemas
- `src/components/motion.tsx`: scroll effects (reveal, parallax, reading progress, count-up)

## How the daily feed works (PRD §9)

- For each user and **local calendar date** (IANA timezone, default `Asia/Kolkata`), assign at most one lesson per active topic.
- Selection is deterministic: the **oldest published lesson** in the topic that the user has neither received nor completed. Ties break by publish date, then ID.
- A lesson is never re-assigned, unless an editor marks it *evergreen/repeatable*. Repeatable lessons can return after a 60-day cooldown, and only when a topic has run out of fresh lessons.
- `Delivery` has unique `(user, lesson, date)` and `(user, topic, date)` constraints, so concurrent or repeated runs cannot duplicate assignments.
- **In-app feed:** assigned on first visit each day (this is also the starter feed right after onboarding) and whenever topics change. Before the delivery time the app never shows an empty feed; delivery time controls the email.
- **Job:** every 15 minutes, for each user whose local time has passed their delivery time, it assigns lessons and, only if they opted in, sends one digest. It claims a unique `NotificationLog(user, channel, template, date)` row *before* sending. Transient failures retry on later runs, up to 3 attempts, and are never duplicated.
- Scheduled lessons auto-publish when their time arrives (by the job, or lazily when a feed loads).
- Topics with no eligible lessons are left out of the feed with a friendly note. Admins see low coverage on **Admin → Overview** and in the job summary.

## Daily reminders (Web Push)

- Learners with **Daily learning reminder** on can enable notifications per device (Settings or onboarding). This registers `public/sw.js` and a push subscription.
- The daily job sends **one reminder per user per local day** to every subscribed device, at their delivery time. It uses the same claim-before-send idempotency as email (`NotificationLog` channel `push`). Subscriptions the push service reports as expired (404/410) are deleted automatically.
- Needs VAPID keys: `npx web-push generate-vapid-keys`, then set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`. Without them the UI says reminders aren't set up, and nothing else changes.
- Browsers: Chrome, Edge and Firefox on desktop and Android. On iPhone/iPad (iOS 16.4+), the app must first be added to the Home Screen. Push doesn't work in private/incognito windows.

## AI draft generation (admin, PRD P1)

- **Admin → New lesson → Generate a draft with AI**: choose a topic, a learning objective and optional source notes. Gemini returns a structured draft (JSON schema), which is validated, clipped to the field limits and **saved as a Draft**.
- The draft's **rights basis is left empty on purpose**, so it can't be submitted until an editor confirms it. The claims to fact-check are listed in **Editor notes** (internal; never shown to learners), and suggested sources are marked "AI-suggested: confirm this source exists".
- Nothing is ever published automatically. Rate-limited to 5 drafts per 10 minutes per admin.
- Set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default `gemini-2.5-flash`). The provider sits behind an interface in `src/server/ai/`, so another provider can be added without touching the CMS.

## Editorial workflow (PRD §11)

`Draft → In review → (Scheduled →) Published → Draft/Archived`, and `Archived → Draft`.

- Drafts may be incomplete. **Submitting, approving, scheduling and rescheduling** require all fields, exactly 3 takeaways, a rights basis, and at least one source for factual lessons. Body length outside 150–250 words is a warning, not a block.
- Lessons past Draft must stay complete after edits. Archived lessons must be restored before editing.
- Every action is written to `AuditLog`, which is shown in the editor as the approval record.
- **Delete** is only allowed for Draft/Archived lessons that no learner has ever received, opened, saved or attempted. Anything with learner history must stay archived, which keeps the audit and source trail intact (PRD §13.1).
- Lessons are plain text rendered as React text nodes, never HTML, so stored XSS is not possible.

## API

All responses use `{ data, error, meta }` with proper status codes (400/401/403/404/409/429/500). Raw database errors are never returned.

| Method & route | Notes |
| --- | --- |
| `POST /api/auth/signup` · `login` · `logout` · `forgot-password` · `reset-password` | Rate-limited. Forgot-password always returns 200. |
| `GET /api/topics` | Public, cacheable |
| `GET/PATCH/DELETE /api/me` | Profile & preferences. `completeOnboarding: true` assigns the starter feed. `DELETE` needs `{ "confirm": "DELETE" }`. |
| `GET/PUT /api/me/topics` | `PUT { topicIds }`: 1–5 valid active IDs, enforced server-side |
| `GET /api/today` | Today's lessons for the user's local date. `meta.emptyTopics` lists topics without content. |
| `GET /api/lessons/:id` | Published lessons only; quiz answers are never included |
| `POST /api/lessons/:id/progress` | `{ status: "started" \| "completed" \| "undo" }` |
| `POST/DELETE /api/lessons/:id/bookmark` | Idempotent (201 created / 200 existing / 204 removed) |
| `POST /api/lessons/:id/quiz` | `{ answers: { [questionId]: "a".."d" } }`, scored server-side |
| `GET /api/me/library?filter=saved\|completed&page=` | Paginated (12 per page) |
| `GET/POST /api/admin/lessons` | Filters: `q`, `topicId`, `status`, `scheduledDate`, `page`. `POST` creates a Draft. |
| `GET/PATCH/DELETE /api/admin/lessons/:id` | `GET` meta includes the publish checklist. `DELETE` only for unused drafts/archived lessons (409 otherwise). |
| `POST /api/admin/lessons/generate` | `{ topicId, objective, sourceNotes? }` → AI Draft (201). 503 when no AI key is configured. |
| `GET /api/push` · `POST/DELETE /api/push/subscription` · `POST /api/push/test` | VAPID public key; save/remove this device's subscription; send a test reminder |
| `POST /api/admin/lessons/:id/publish` · `/schedule` · `/status` | `/status { action, scheduledAt? }` handles every transition |
| `POST /api/jobs/daily-delivery` | `Authorization: Bearer $CRON_SECRET`; idempotent (also accepts GET for Vercel Cron) |
| `POST /api/unsubscribe?token=` | One-click unsubscribe (RFC 8058) |
| `POST /api/events` | Client-only analytics (`lesson_listen_started`) |

Example lesson payload: see `prisma/seed-content/*.json` (same shape as PRD Appendix B).

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | `file:./dev.db` locally; Postgres URL in production |
| `APP_URL` | yes | Absolute base URL used in email links |
| `CRON_SECRET` | yes | ≥16 chars; protects the job endpoint |
| `EMAIL_PROVIDER` | yes | `console` \| `resend` (`memory` is test-only) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO` | for email | Verified sending domain required (SPF/DKIM/DMARC) |
| `NEXT_PUBLIC_APP_NAME`, `SUPPORT_EMAIL` | no | Branding and contact address |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | for reminders | Web Push keys (`npx web-push generate-vapid-keys`) |
| `AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL` | for AI drafts | Admin "Generate draft". Off when the key is empty. |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | no | Admin account created by the seed |

## Deploying to production

1. Create a Postgres database (e.g. Supabase). In `prisma/schema.prisma` set `provider = "postgresql"`, delete `prisma/migrations`, and run `npx prisma migrate dev --name init` against a **development** Postgres to generate Postgres migrations. Commit them.
2. Set the environment variables in your host (e.g. Vercel). Use separate dev and prod databases.
3. Build command: `npx prisma migrate deploy && npm run build`.
4. Seed once: `npm run db:seed` with `DATABASE_URL` pointing to production, then create editors with `npm run admin:create`.
5. Configure the cron (see above) and verify a run under **Admin → Overview → Scheduled job runs**.
6. Rollback: redeploy the previous build in your host. Migrations are additive; restore from a database backup if a migration must be undone.

## Testing & QA evidence

- `npm test`: **55 tests**. Timezone/local-date maths, streaks, validation limits, status machine, publish checklist, feed rules (oldest-first, no repeats, completed skipped, unpublished hidden, evergreen cooldown, concurrency), job idempotency, email retry limits, push reminders (once per day, expired subscriptions pruned), unsubscribe, 1–5 topic enforcement, password reset, account deletion, per-user isolation, quiz answer secrecy, lesson deletion rules, and AI drafting (Gemini request/response handling, safety blocks, limits, never publishable as-is).
- `npm run test:smoke`: **71 HTTP checks** against the production build, covering the PRD §19 Definition of Done (auth, onboarding, feed, lesson, bookmark/complete, isolation, CSRF, admin workflow, AI-draft access control, lesson deletion, job idempotency, sign-out, deletion).
- `scripts/qa-push.ts`: real Edge subscribed through Windows Notification Service, and the server delivered a test reminder.
- `scripts/qa-screens.ts`: all 13 core screens at 360px and 1280px, with **no horizontal overflow**. Screenshots go to `qa-screenshots/`.
- `npm run content:check-links`: 90 of 103 source URLs respond and none are broken. The other 13 (Britannica, IPCC, PMI, ASQ, Gartner, FINRA) block automated requests and need a quick manual check.

## Known limitations & next sprint

- **Starter content needs editorial review.** The 60 lessons are original but AI-assisted drafts, published so every topic works. An editor must fact-check them and verify their source links before public launch (PRD §8.1).
- **Legal pages are templates.** Terms, Privacy and Disclaimer must be reviewed by the product owner.
- **The rate limiter is in-memory** (per instance). Use Redis/Upstash when scaling horizontally.
- **AI drafting is untested against the live Gemini API** (no key was available). The request/response handling is unit-tested with mocks. Run one real draft after setting `GEMINI_API_KEY`, and update `GEMINI_MODEL` if Google has retired the default.
- **Read-aloud uses browser voices.** Quality varies by device; cloud TTS is Phase 1.1.
- **Deferred P2:** native apps, offline audio, recommendations, payments.
