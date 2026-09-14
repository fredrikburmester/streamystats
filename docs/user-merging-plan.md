# Permanent user merge

Admins select one old Streamystats account and one destination on the same server, review the transferred record counts, type MERGE, and confirm. The source may already have been deleted from Jellyfin. There is no grouping, unlinking, or undo endpoint.

The transaction moves playback history (including itemless and orphaned history identified by the source Jellyfin ID), private watchlists, hidden recommendations, activities, and security events. Watchlists retain their IDs and contents, even when names match. Hidden recommendations are deduplicated. The destination keeps its configured inference preference; an unset preference inherits the source value. Source statistics exclusions are removed; destination and library exclusions continue applying.

The source user row is deleted. The destination retains its Jellyfin identity, permissions, and administrator status. Existing source sessions and later logins are rejected by Streamystats; the merge does not change Jellyfin itself. Historical payloads and security-event descriptions retain their original attribution.

A permanent retired-ID mapping redirects future sync/import writes to the destination and prevents the old user row from being recreated. Chained merges flatten these mappings. PostgreSQL ingestion triggers take a shared advisory lock scoped to the server; a merge takes the exclusive lock before updating ownership. Affected rows are locked without waiting, with bounded transaction retries if an ingestion update already holds a row lock. The transaction includes an audit record and operation ID for safe retries. Derived analytics caches are invalidated, and security fingerprints are rebuilt from transferred activity.

Application backups include retirement mappings and destination names. Restoring them requires the same verified Jellyfin server, preserves current destination permissions, creates missing historical destinations without access permissions, and rejects conflicting mappings. It never unmerges existing accounts.
