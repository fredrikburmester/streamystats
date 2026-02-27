# Timezone Support

## Architecture

- **Jellyfin**: Sends ISO 8601 timestamps (UTC)
- **Database**: All columns use `timestamptz` (PostgreSQL stores as UTC)
- **Configuration**: Per-server `timezone` column (IANA identifier, e.g., `"America/New_York"`)
- **Conversion**: Client-side only via React context

## Key Files

| File | Purpose |
|------|---------|
| `packages/database/src/schema.ts` | `timezone` column on `servers` table |
| `lib/timezone.ts` | Conversion utilities (`formatLocalDate`, `utcHourToLocalHour`) |
| `lib/timezone-data.ts` | IANA timezone options list |
| `providers/ServerTimezoneProvider.tsx` | React context provider |
| `components/FormattedDate.tsx` | Reusable date display component |
| `settings/general/TimezoneManager.tsx` | Admin UI for setting timezone |

## Usage

```tsx
// Access timezone in client components
const timezone = useServerTimezone();

// Format dates
<FormattedDate date={someUtcDate} format="datetime" />

// Convert hours
const localHour = utcHourToLocalHour(utcHour, timezone);
```

## Rules

1. Server always sends UTC
2. Client always converts using `useServerTimezone()`
3. Never mix server-side and client-side conversion
4. Never use `toLocaleString()`, `toLocaleDateString()`, or `toLocaleTimeString()` for dates — causes hydration mismatch
5. Always use `<FormattedDate>` or `formatLocalDate()` with timezone parameter
