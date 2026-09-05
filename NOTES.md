# NOTES

## Setup

```bash
pnpm install
docker compose up -d
pnpm db:migrate
pnpm db:seed
pnpm dev
pnpm test
pnpm ingest
```

- Postgres runs in Docker, host port **5433** (`docker-compose.yml`). The
  container also provisions a second, empty database —
  `clipping_marketplace_test` — via `docker/init-test-db.sql`
  (`/docker-entrypoint-initdb.d`), so `pnpm test` never touches the dev/seed
  database. This only runs on a fresh volume; if you already had the
  container running before pulling this branch, recreate the volume once
  with `docker compose down -v && docker compose up -d`.
- Copy `.env.example` to `.env.local` (already includes working local
  defaults for Docker Postgres on port 5433) before running anything.
- `pnpm test` runs a `pretest` hook that migrates the test database
  automatically — no separate setup step needed.
- Dev users (via the switcher in the top-right of the nav, seeded by
  `pnpm db:seed`): `admin@example.com` (admin), `alice@example.com` /
  `bob@example.com` (creators).
- `pnpm ingest` fakes one day of metrics sync for every approved/paid
  submission (see "Metrics ingestion" below).

## Concurrent approvals

`src/server/services/approval.ts` — `approveSubmission`.

Two admins approving different submissions on the same campaign at the same
instant must never both succeed if the budget only covers one of them. I
used a single Postgres transaction per approval that locks both the
submission row and the campaign row with `SELECT ... FOR UPDATE`, in that
order, before computing the payout and checking it against the remaining
budget (`total_budget - sum(payout_cents)` of already-approved/paid
submissions on that campaign).

Locking the **campaign** row is what actually serializes concurrent
approvals: a second transaction trying to approve a different pending
submission on the *same* campaign blocks on that row lock until the first
transaction commits or rolls back, then re-reads the up-to-date spent total
before deciding. Approvals on different campaigns never contend with each
other. The submission row lock additionally makes a double-approval race on
the *same* submission fail cleanly (`CONFLICT`, "already reviewed") instead
of double-paying it.

The payout is locked in and stored on the submission (`payout_cents`,
migration `0001_add_submission_payout_cents.sql`) at approval time, not
recomputed live from the latest metric afterwards. That's a deliberate
choice beyond what the spec says explicitly — see "Assumptions" below.

**Alternatives considered:**

- **Plain `if (remaining >= payout) approve()`** — the obvious
  read-then-write approach. Rejected: it's a check-then-act race under
  concurrent transactions; two transactions can both read the same
  "remaining" value before either writes, and both pass the check.
- **Optimistic locking (a `version`/`updated_at` compare-and-swap on
  `campaigns`)** — would work, but pushes retry logic into the router/UI
  ("someone else just approved something, try again") for no benefit here:
  approvals are short, and there's no reason to let the second admin's
  request fail *transiently* when a lock will resolve it correctly on the
  first try.
- **`SERIALIZABLE` isolation** — correct, but heavier: the whole app would
  need retry-on-serialization-failure handling for a guarantee `FOR UPDATE`
  already gives us for this specific access pattern (lock exactly the two
  rows this operation touches).
- **A Postgres advisory lock keyed by campaign id** — functionally similar
  to locking the campaign row, but `FOR UPDATE` is simpler here since we're
  already reading that row anyway to get `total_budget` and `status`.

Verified with a real integration test
(`src/server/services/approval.test.ts`) that fires two `approveSubmission`
calls concurrently via `Promise.allSettled` against a campaign whose budget
covers exactly one of them: exactly one settles fulfilled, one rejected
(`PRECONDITION_FAILED`), and the DB ends up with exactly one `approved`
submission and `spent <= total_budget`.

## Metrics ingestion

`src/server/services/ingest.ts` (`pnpm ingest` → `src/scripts/ingest.ts`,
a thin CLI wrapper around it).

For each `approved`/`paid` submission: skip if a metric row already exists
for today (UTC) — that's what makes a same-day rerun a no-op. Otherwise,
insert one new row using the previous row's views/likes/comments as a
floor plus a random positive increment, so counts only ever go up. Each
submission is wrapped in its own `try/catch`; a failure is recorded and
reported in the summary (`processed / created / skipped / failed`) without
stopping the run for the rest. A `unique_violation` on
`(submission_id, captured_at)` — a duplicate/concurrent run for the same
day — is treated as `skipped`, not `failed`, since the outcome is the same
as if the row had never been attempted.

## Assumptions (things the spec didn't pin down, and I picked one)

- **Payout is locked in at approval, not recomputed from later metrics.** I
  added `submissions.payout_cents` (nullable, set only when
  `approved`/`paid`) and a check constraint enforcing that. Reasoning: the
  spec's ceiling is "a campaign never pays out more than total_budget" —
  if spend were instead recomputed live from ever-growing view counts,
  budget spent could silently drift past the amount that was actually
  available at approval time, which is the opposite of what "never exceeds"
  should mean. This does mean "my submissions" shows a *live estimate* for
  pending submissions and the *actual, locked-in* amount once approved —
  which also matches the word "estimated earnings" in the spec (4.3),
  since something already approved isn't an estimate anymore.
- **Daily views chart** is approved+paid submissions only, not all
  submissions regardless of status — it reads as the metric that explains
  the budget-spent number above it, not raw platform noise from
  not-yet-reviewed clips.
- **URL validation** (`src/shared/post-url.ts`) uses platform-specific
  regexes (TikTok `@user/video/<id>`, `vm.tiktok.com/<id>`; Instagram
  `/reel|p|tv/<id>`; YouTube `watch?v=`, `/shorts/`, `youtu.be/`) rather
  than just checking the hostname, per "has to look like a real post URL."
  It'll reject profile/home URLs on all three platforms.
- **`campaigns.listActive`** (creator browse) is `protectedProcedure`
  rather than creator-only — an admin can look, only creators can submit.
  Didn't see a reason to lock browsing to one role.
- Money is integer cents everywhere, including in the admin campaign form
  (labelled explicitly, e.g. "Payout per 1,000 views (cents)") — no
  dollar-to-cents conversion layer, to avoid introducing a float step.

## Deliberately omitted

- Real auth (signed dev cookie + user switcher only, as specified).
- Custom visual design — shadcn defaults, no theming.
- Pagination on the creator's "browse active campaigns" (capped at 50,
  no admin-scale volume expected there) and on "my submissions".
- Optimistic UI updates — mutations invalidate and refetch instead.
- Retrying/backoff tuning beyond "don't retry 4xx tRPC errors" (see AI
  tooling below).
- Rate limiting, audit log, email notifications, campaign soft-delete.

## First thing I'd fix given another day

Two things, in order:

1. **Ownership on the campaign-detail route.** Every procedure enforces
   role, but a couple of admin-only reads (`campaigns.getById`,
   `campaigns.dailyViews`, `submissions.pendingForCampaign`) don't currently
   distinguish "campaign doesn't exist" from anything else — fine for a
   single-admin-org take-home, but if this became multi-tenant (agencies
   each owning their own campaigns) that's the seam where a real ownership
   check would need to land next to the existing role check.
2. Replace the client-side `for (submission of approvedSubmissions)`
   sequential loop in `runMetricsIngest` with a bounded-concurrency batch —
   fine for a take-home's worth of rows, not for real volume.

## AI tooling

Used throughout — scaffolding routers/services, drafting the shadcn-based
UI screens, and brainstorming the test list. Specifically corrected/checked
by hand rather than taken as-is:

- **The budget/concurrency design** (row-locking strategy, what gets locked
  in at approval vs. recomputed live) was reasoned through and decided
  manually, then implemented and verified with the concurrent-approval
  integration test — this is the part of the assignment explicitly called
  out as highest-stakes, so I didn't want to trust a first-pass suggestion
  here without a real `Promise.allSettled` test proving only one write
  wins.
- **Schema and the generated migration** (`payout_cents` addition) were
  reviewed by hand against the existing check-constraint style already in
  the repo before running `drizzle-kit generate`.
- **A genuine bug I had to catch and fix**: initially the client's
  `QueryClient` used a flat `retry: 1`. Testing the FORBIDDEN-access UI
  path (an admin hitting a creator-only procedure) in the browser, the page
  got stuck on "Loading…" forever instead of showing the error. Root cause:
  TanStack Query's retry scheduling went to `fetchStatus: 'paused'`
  waiting to come back online, and a permanent 4xx error (`FORBIDDEN`) is
  never going to resolve by retrying regardless of connectivity. Fixed by
  making `retry` inspect the tRPC error's `httpStatus` and skip retries for
  4xx responses (`src/trpc/provider.tsx`) — a correctness fix I found by
  actually clicking through the error states in a browser, not something
  the AI-generated first pass caught on its own.
- Test DB isolation was also something I had to catch myself: the first
  version of the integration tests ran against the same `DATABASE_URL` as
  the seeded dev database and polluted it with test users/campaigns (visible
  in the dev switcher dropdown). Fixed by giving tests their own database
  (`TEST_DATABASE_URL` / `clipping_marketplace_test`, auto-provisioned via
  a Postgres init script) rather than trusting the first draft's DB wiring.

## Deploy

Env vars needed: `DATABASE_URL`, `AUTH_COOKIE_SECRET` (long random string),
`ENABLE_DEV_USER_SWITCHER=true` (gates the dev-only `auth.devUsers` /
`auth.switchUser` / `auth.clearUser` procedures — keep this `true` for the
evaluator to be able to use the switcher at all). Run `pnpm db:migrate`
against the target database before first boot, then `pnpm db:seed` once for
demo data.
