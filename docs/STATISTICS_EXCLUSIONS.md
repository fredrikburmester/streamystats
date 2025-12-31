# Statistics Exclusions

## Overview

Streamystats supports excluding specific users and libraries from all statistics. This is an admin-only feature that hides data from the UI while still collecting and syncing all underlying data.

## Database Schema

Exclusion settings are stored on the `servers` table:

```typescript
// packages/database/src/schema.ts
excludedUserIds: text("excluded_user_ids").array().default([]),
excludedLibraryIds: text("excluded_library_ids").array().default([]),
```

## Helper Functions

All exclusion logic is centralized in `apps/nextjs-app/lib/db/exclusions.ts`. The primary helper is `getStatisticsExclusions`.

```typescript
import { getStatisticsExclusions } from "./exclusions";

// Fetch all exclusion filters at once
const { 
  userExclusion,          // SQL condition for sessions.userId
  itemLibraryExclusion,   // SQL condition for items.libraryId (requires join)
  requiresItemsJoin       // Boolean: do we need to join items table?
} = await getStatisticsExclusions(serverId);
```

## Implementation Pattern

### For Session Queries

Use the pre-built `userExclusion` and `itemLibraryExclusion` conditions.

```typescript
import { and, eq } from "drizzle-orm";
import { getStatisticsExclusions } from "./exclusions";

const { userExclusion, itemLibraryExclusion, requiresItemsJoin } = 
  await getStatisticsExclusions(serverId);

const whereConditions: SQL[] = [
  eq(sessions.serverId, serverId),
  // ... other conditions
];

// Always add user exclusion
if (userExclusion) {
  whereConditions.push(userExclusion);
}

let query = db
  .select({ /* ... */ })
  .from(sessions);

// Conditionally join items if needed for library exclusion
if (requiresItemsJoin) {
  query = query.innerJoin(items, eq(sessions.itemId, items.id));
  whereConditions.push(itemLibraryExclusion!);
}

const results = await query.where(and(...whereConditions));
```

### For Library Queries

Use `librariesTableExclusion` when querying the `libraries` table directly.

```typescript
const { librariesTableExclusion } = await getStatisticsExclusions(serverId);

if (librariesTableExclusion) {
  whereConditions.push(librariesTableExclusion);
}
```

### For User Queries

Use `usersTableExclusion` when querying the `users` table directly.

```typescript
const { usersTableExclusion } = await getStatisticsExclusions(serverId);

if (usersTableExclusion) {
  whereConditions.push(usersTableExclusion);
}
```

## Files Updated

The following statistics files implement exclusions:

| File | Exclusion Type |
|------|----------------|
| `lib/db/statistics.ts` | User + Library |
| `lib/db/users.ts` | User + Library |
| `lib/db/client-statistics.ts` | User |
| `lib/db/transcoding-statistics.ts` | User |
| `lib/db/library-statistics.ts` | User + Library |
| `lib/db/items.ts` | User |
| `lib/db/history.ts` | User + Library |
| `lib/db/similar-statistics.ts` | User + Library |
| `lib/db/similar-series-statistics.ts` | User + Library |
| `lib/db/user-similarity.ts` | User |
| `lib/db/seasonal-recommendations.ts` | Library |

## Checklist for New Statistics Functions

When creating a new statistics query function:

1. [ ] Import `getStatisticsExclusions` from `./exclusions`
2. [ ] Fetch exclusion settings: `const { userExclusion, itemLibraryExclusion, requiresItemsJoin } = await getStatisticsExclusions(serverId);`
3. [ ] Add `userExclusion` to where conditions
4. [ ] If library exclusion is relevant:
    - Join `items` table if `requiresItemsJoin` is true (or if you need it anyway)
    - Add `itemLibraryExclusion` to where conditions

## Settings UI

Admins can manage exclusions at:
`/servers/[id]/settings/exclusions`

The UI is in:
- `app/(app)/servers/[id]/(auth)/settings/exclusions/page.tsx`
- `ExcludedUsersManager.tsx`
- `ExcludedLibrariesManager.tsx`

## Cache Invalidation

When exclusion settings change, the following cache tags are invalidated:
- `exclusion-settings-{serverId}`

The exclusion settings themselves are cached with `cacheLife("hours")`.
