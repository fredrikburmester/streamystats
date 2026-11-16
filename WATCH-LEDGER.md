# Watch Ledger for Streamystats

Watch Ledger adds a daily viewing history, activity calendar, weekly/monthly recaps, manual logs, lists, ratings, and reversible corrections. Raw Sessions keeps the original playback records available.

## Installation

Run from the source checkout on your Docker host:

```bash
bash install-ledger.sh --check
bash install-ledger.sh --install
```

The installer discovers a single Compose `nextjs-app` container and the `job-server` and `vectorchord` containers in its project. For multiple installations or custom names, set `LEDGER_APP_CONTAINER`, `LEDGER_JOB_CONTAINER`, and `LEDGER_DB_CONTAINER`. It builds locally, briefly stops the apps, takes and validates a full PostgreSQL backup, and recreates only the two apps. Docker Compose V2 with `--wait` support is required. Keep the source directory and the printed backup location. Backups are excluded from Git and Docker build contexts. Do not use `docker compose down -v`.

`bash install-ledger.sh --rollback` restores the original Compose images. The additive ledger table is retained. Rollback does not delete imports or corrections.

## Users, imports, and settings

Open Watch Ledger and choose a user. Regular accounts can access themselves. Administrators can select another user after their current privileges are verified with Jellyfin. **Imports, manual logs, corrections, ratings, and settings belong to the selected user.** Selecting another user as an administrator lets you edit that user's ledger.

Import SIMKL JSON for episode history and CSV for list metadata. Import dates are retained as supplied. There is no setup-day cutoff and no automatic classification of older dates as estimated. Missing or sentinel dates remain unknown. Existing imports retain their original dates and are normalized on read without rewriting their source records. Legacy estimated labels are preserved when a supplied date exists. Dated estimates use the same daily cards and chronological placement as other watches, with an Estimated date badge. Only genuinely undated watches appear under Watch date unknown. Imported and manual runtime remain separate from recorded Jellyfin playback; their cards identify their source. An import's runtime is a title-runtime total, not a playback measurement.

Imports are additive: an older backup cannot remove episodes found in an earlier upload. Reimporting the same episode retains its later available watch date. CSV supplies list status, ratings, and last-episode summaries; JSON supplies detailed history. Imports do not write to SIMKL or Jellyfin.

Completion defaults to 90%, timezone follows the server (UTC fallback), and confirmed prior titles start empty. These settings can be changed for the selected user. Confirmed prior titles are useful for undated prior viewings. Manual-log retries reuse one request identity; close the form before intentionally logging a different watch.

## History and statistics

Each dated history heading shows the full daily watch time in hours and minutes, even when its cards span pages. The total follows the imported/estimated statistics switch; hover for the recorded and imported/manual breakdown. Undated history has no daily total. Search and media-type filters affect the totals; the watch-status filter only changes the visible cards.

Monthly and Monday-to-Sunday weekly recaps appear inside history above the entries for their period, including older periods. Recap markers do not repeat when pagination continues within the same period. Current periods are labeled so far. Recaps show TV/movie/anime runtime totals, activity mini-calendars, average per active day, peak day, and poster rankings by category. Posters use available Jellyfin metadata or enabled SIMKL images; unavailable artwork has an icon fallback.

The per-user **Include imported/estimated watches in statistics** switch defaults off and is shared between Watch Ledger and the Streamystats dashboard. History cards remain visible either way. Confirmed manual logs always count; the switch controls SIMKL imports and estimated manual logs. Enabling it adds completed standalone watches to viewing totals, watch-time charts, title rankings, user summaries, and activity counts. Recorded playback and imported/manual runtime are labeled separately. Imports matched to an existing recorded watch contribute no extra runtime. Unknown dates can contribute to lifetime totals but never to a fabricated calendar date.

Raw-session, device, transcoding, library, and genre measurements remain based on actual sessions. Other upstream Wrapped panels retain their existing calculations. Titles outside Jellyfin can appear in viewing rankings without a fabricated library link. User exclusions and known library exclusions apply; an external title with no library match has no assigned library.

Ledger hides playback sessions whose duration would display as 0m. These sessions are excluded from Ledger cards, session counts, watch-time totals, activity, and recaps, including existing history. The underlying records and accumulated completion coverage remain available; Raw Sessions and other Streamystats statistics keep their original data. Standalone manual logs and SIMKL imports are preserved even when their runtime is missing or under a minute.

## Watches and corrections

Sessions for an unfinished episode are combined across pauses, days, and devices. Legacy recordings lack sufficient coverage data to reliably infer repeat viewings, so they are grouped conservatively and can be corrected manually. New recordings accumulate unique watched portions. A restart near the beginning after completion opens a tentative new watch, counted as a completed rewatch only after reaching the completion threshold.

Earlier days of a multi-day watch show In progress and its final day shows Completed. History's Watch status filter uses the whole watch's current status, so completed watches are excluded from In progress on every day. Search, media type, and date filters apply before pagination. History loads 100 cards per page; headline, activity, and recap totals use all matching supported history, not just that page. Lists show 100 titles per page.

Open a card's arrow menu to mark completion, change rewatch status/date, or hide the watch. Reset corrections to undo. Raw sessions are retained. Wrapped uses completed watches for its rewatch section.

## Limits

- Jellyfin's polled Sessions response does not provide seek events or playback speed. Coverage accepts plausible normal-speed progression and rejects obvious jumps. Subsecond seeks indistinguishable from polling jitter cannot be detected reliably. Faster playback can be undercounted; manual completion remains available.
- A final playback position is included when Jellyfin supplies a matching final observation. A vanished session supplies no final position, so the unobserved tail is not fabricated.
- Sessions spanning midnight are attributed to their start date.
- Reads are bounded to 50,000 sessions, 10,000 ledger records/series, and 32 MB of ledger JSON per user. Exceeding a limit shows an explicit error rather than silently truncating history. Imports exceeding the record/JSON limits roll back. Ledger builds use short-lived caching, compact projections, and paginated responses; unlimited-history materialized aggregates are not implemented.
- Shared imported statistics support up to 100 eligible accounts per server. When library exclusions are active, matching supports up to 50,000 Movie/Series catalog titles. Exceeding either bound returns an explicit error.
- No live SIMKL/Trakt sync or external catalog search. Enter a title manually or use imported titles.
- Unknown episode numbering on removed library items is preserved without guessing.
- Upstream JSON exports do not include ledger additions. Use full PostgreSQL backups.
- Missing posters can use SIMKL's public image server; disable remote posters in settings for offline images.

Upstream: https://github.com/fredrikburmester/streamystats. Retain upstream license and attribution.
