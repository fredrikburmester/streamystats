# Watch Ledger validation

Timeline and shared statistics update, 2026-10-30, based on fork main `1acdccfcc1157751a5c98ed7a62cdadceaaaef8d`.

Passed for this update:

- Both app TypeScript checks and database package build.
- Next.js production compilation, including the ledger and dashboard routes.
- 66 relevant tests across nine suites, including the ledger, coverage, poller, persistence, and item resolver tests.
- Timeline tests cover estimated dates in normal history, unknown dates at the bottom, shared inclusion rules, recap placement at week/month/year boundaries, and markers not repeating across pages.
- PostgreSQL/PGlite integration covers the shared settings flag, imported viewing totals in the original statistics query, date filtering, user scope, and an import matching a newly recorded session without double counting.
- Statistics model tests cover confirmed manual logs with the switch off, exclusions, no invented runtime for inferred history, overlap suppression, and outside-library ranking cards.
- A browser visual check of a static rendering of the actual Ledger component with synthetic recorded, dated imported, estimated, and undated watches verified the source toggle, inline recaps, and chronological estimated cards. This was not a hydrated interaction or live Jellyfin test.
- Git whitespace checks.

Reproduce with Bun:

```bash
bun install --frozen-lockfile
bun run build:database
bun run typecheck
bun test apps/nextjs-app/lib/ledger/__tests__
bun test apps/job-server/src/jobs/watch-coverage.test.ts apps/job-server/src/jobs/session-poller.test.ts apps/job-server/src/jobs/session-poller-persistence.test.ts apps/job-server/src/jobs/session-item-resolver.test.ts
bun run build:nextjs
```

No live Docker deployment or Jellyfin connection was available. Existing containers and the user's database were not modified. No new database migration or dependency is required. Supported limits and measurement distinctions are documented in WATCH-LEDGER.md. Previous review resolutions remain documented in REVIEW-FIXES.md.


Zero-minute Ledger display follow-up, 2026-11-16:

- Ledger-only filtering uses the same whole-minute formatting boundary as the UI. Existing raw playback records and coverage are preserved.
- Regression checks cover 0s/15s/59.4s hidden, 59.5s/60s visible, removal from cards/session counts/activity/recaps/totals/pagination, no extra day from a short resume, retained completion and corrections, and unchanged standalone imported/manual entries.
- All 51 ledger tests, database build, Next.js TypeScript, production compilation, and Git whitespace checks pass. No live server deployment was performed for this follow-up.
