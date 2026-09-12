import { formatLogTimestamp } from "../../utils/log-timestamp";

type SyncLogBaseFields = {
  server: string;
  page: number;
  processed: number;
  inserted: number;
  updated: number;
  errors: number;
  processMs: number;
  totalProcessed: number;
};

type SyncLogExtraValue = string | number | boolean;
type SyncLogFields = SyncLogBaseFields & Record<string, SyncLogExtraValue | null | undefined>;

const BASE_KEY_ORDER: Array<keyof SyncLogBaseFields> = [
  "server",
  "page",
  "processed",
  "inserted",
  "updated",
  "errors",
  "processMs",
  "totalProcessed",
];

function isBaseKey(key: string): key is keyof SyncLogBaseFields {
  return (BASE_KEY_ORDER as ReadonlyArray<string>).includes(key);
}

function formatValue(value: SyncLogExtraValue): string {
  return String(value);
}

export function formatSyncLogLine(prefix: string, fields: SyncLogFields): string {
  const parts: string[] = [formatLogTimestamp(), `[${prefix}]`];

  for (const key of BASE_KEY_ORDER) {
    parts.push(`${key}=${formatValue(fields[key])}`);
  }

  const extras = Object.keys(fields)
    .filter((k) => !isBaseKey(k))
    .sort((a, b) => a.localeCompare(b));

  for (const key of extras) {
    const value = fields[key];
    if (value === undefined || value === null) continue;
    parts.push(`${key}=${formatValue(value)}`);
  }

  return parts.join(" ");
}


