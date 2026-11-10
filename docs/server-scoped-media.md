# Server-scoped media identifiers

Jellyfin media IDs are unique within one server. Libraries, items and media sources therefore use `(server_id, id)` primary keys. Public APIs and Jellyfin calls continue using the original Jellyfin IDs alongside their existing server context.

Item relationships, cast links, watchlists, sync mutations, history joins and statistics lookups carry the server scope. Deleting an item clears only `sessions.item_id`; it preserves the session and its server. The migration's `ON DELETE SET NULL (item_id)` clause is intentional: Drizzle currently models only the general `set null` action.

## Existing installations

Migration `0045_server_scoped_media_ids` preserves historical references when an earlier collision moved an item or library to another server. It creates missing copies under the referencing server, backfills watchlist server IDs, then installs the composite constraints. Copied items have their etag, embedding and processing flags invalidated.

The migration cannot reconstruct metadata already overwritten by an earlier sync. Run a full sync on each affected server after upgrading to restore authoritative library and item metadata. Previously deleted rows without surviving references cannot be recovered by the migration.

The old `0043` snapshot had the same parent as `0042`; its parent link is repaired so Drizzle can generate future migrations. Changes already applied by `0042` and `0044` are not reapplied in `0045`.

## Verification

Use a disposable PostgreSQL database with pgvector available and a role permitted to create databases:

```sh
bun run build:database
STREAMYSTATS_TEST_DATABASE_URL=postgresql://postgres@localhost/streamystats_test bun test
```

The sync suite creates and removes its own child database to exercise the upgrade from pre-fix data. The query suite uses unique fixture rows in the supplied test database and removes them afterward. Tests cover overlapping libraries, items, media sources and people; full/recent sync; replacement migration; ownership constraints; deletion behavior; item details; history; statistics; and watchlists.
