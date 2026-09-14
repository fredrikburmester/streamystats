# User merging

Implemented design: reversible grouping of same-server accounts for analytics.

## Using the feature

Admins open **Users → Merge users**, select accounts, choose the primary name/avatar, then preview and confirm. Historical accounts retained locally after deletion from Jellyfin are selectable. Identical names are distinguished by account IDs.

**Merged accounts (N)** on the combined profile opens management. Add ungrouped accounts, change primary, or uncheck accounts to unlink. Choose another primary before removing the current primary. A group reduced to one account dissolves. Accounts already in another group must first be unlinked.

Example: 20 hours on an old account and 30 on its replacement display as 50. Another 5 hours on the replacement display as 55. Unlink restores 20 and 35. Sessions are never rewritten or deduplicated.

## Behavior and boundaries

- Grouped analytics cover user lists/profiles, history filters, leaderboards, active-person counts, item viewers, client statistics, Wrapped, taste, and recommendation history.
- Member profile URLs temporarily redirect to the primary; unlinking restores the original URL. History retains original account attribution.
- Statistics exclusions apply to source accounts before aggregation. Library access uses the actual viewer, including when another member is an administrator.
- Login, Jellyfin tokens, admin flags, private lists, hidden recommendations, inference preferences, security monitoring, live-session identities, and write permissions remain account-specific.
- New playback and user-sync updates retain original IDs and automatically participate in grouped analytics. Grouping does not change Jellyfin accounts.
- Cross-server merging, automatic matching by name, and repair of already-unattributed sessions (`userId = null`) are outside this feature.

## Data and concurrency

`user_groups` stores primary ID and revision. `user_group_members` maps each account to at most one group. Composite foreign keys enforce server boundaries. A deferred constraint requires the primary to remain a member, while allowing atomic creation and server deletion. Standalone member deletion requires unlinking first.

`user_group_audit` records actor, operation ID, request hash, before/after membership, and timestamps. Membership changes lock the server row, check revisions and preview state, then commit atomically. Identical retries return the original result; conflicting or stale requests return 409. Playback may grow between preview and confirmation.

Shared database helpers expand a requested account into its members and resolve each source account to the primary for SQL grouping. Person counts group before sorting/pagination; session history remains unmodified. All dependent Next caches use the `user-analytics` tag. Changes expire that tag immediately and refresh server routes/client queries. The tag currently spans servers to cover every nested analytics cache.

## Management API

All routes require `requireAdmin(serverId)` with cookie authentication.

| Route | Purpose |
| --- | --- |
| `GET /api/servers/[serverId]/user-groups` | Accounts, groups/revisions, CSRF token; private and non-cacheable |
| `POST /api/servers/[serverId]/user-groups/preview` | Validate desired membership; return counts, watchtime, and preview token |
| `POST /api/servers/[serverId]/user-groups` | Create, edit, change primary, or unlink using desired membership |

Preview body:

```json
{
  "groupId": null,
  "primaryUserId": "replacement-account-id",
  "memberUserIds": ["old-account-id", "replacement-account-id"],
  "expectedRevision": null
}
```

For edits, supply the existing group ID and revision. Commit body:

```json
{
  "change": { "groupId": null, "primaryUserId": "replacement-account-id", "memberUserIds": ["old-account-id", "replacement-account-id"], "expectedRevision": null },
  "previewToken": "sha256-token-returned-by-preview",
  "operationId": "a-new-uuid-for-this-operation"
}
```

Send the overview's token as `X-User-Groups-CSRF` on POST requests. It is signed, scoped to the admin/server, and valid for the current or previous hour. It supports proxies whose internal URL differs from the browser's origin without trusting forwarded-host headers. Direct same-origin requests also pass the strict origin check. Cross-site fetch metadata never grants access. Reuse the same operation ID when retrying an uncertain save; reload accounts and preview again after a conflict or expired token.

## Backup portability

Backup format revision 2 includes groups and only member IDs/names. Restore verifies the Jellyfin system ID, recreates missing historical members as disabled identities without imported privileges, and preserves current accounts' live permissions. Conflicting memberships or IDs belonging to another server return 409. Exact repeats are idempotent. Legacy backups remain supported.

Restore group identities before sessions so historical member references survive. Existing item restoration rules still apply: sync destination libraries/items before importing history. Server identity must match for grouped backups, even when the general import `force` option is used.

## Validation

The PostgreSQL suites cover merge/new playback/sync-shaped updates/unlink, original session preservation, source exclusions, restricted viewers merged with admins, database constraints, stale/concurrent edits, retries, and backup conflicts. Route scenarios exercise a fresh-server export/import roundtrip with a historical account and repeat import. Actual analytics functions verify combined totals, distinct counts, streaks, Wrapped, client statistics, history, and exclusions.

```sh
# Point only at a disposable, migrated database with a name ending in _test.
export STREAMYSTATS_TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/streamystats_test
bun test packages/database/tests/user-groups.integration.test.ts
cd apps/nextjs-app
bun test
```

Local verification also includes both-app typechecking, production compile build, changed-file Biome checks, and desktop/mobile browser merge/unlink with cache refresh and alias redirects. A 20,000-session membership lookup returned the correct total in 16 ms on an isolated local PostgreSQL fixture; this is not a production capacity benchmark. Real Jellyfin polling across a process restart was not exercised by these fixtures.
