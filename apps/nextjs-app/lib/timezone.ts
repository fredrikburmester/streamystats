import { format, formatDistanceToNow, fromUnixTime } from "date-fns";
import { fromZonedTime, getTimezoneOffset, toZonedTime } from "date-fns-tz";

// Default timezone when none is specified
export const DEFAULT_TIMEZONE = "Etc/UTC";

// Legacy: Keep for backward compatibility during migration
export const TIMEZONE = process.env.TZ || DEFAULT_TIMEZONE;

/**
 * Converts a UTC hour to the local hour in the specified timezone
 * @param utcHour Hour in UTC (0-23)
 * @param timezone IANA timezone identifier (e.g., "America/New_York")
 * @returns Hour in the specified timezone (0-23)
 */
export function utcHourToLocalHour(
  utcHour: number,
  timezone: string = DEFAULT_TIMEZONE,
): number {
  // Create a date for today at the specified UTC hour
  const today = new Date();
  const utcDate = new Date(
    Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
      utcHour,
      0,
      0,
      0,
    ),
  );

  // Convert to the target timezone
  const zonedDate = toZonedTime(utcDate, timezone);
  return zonedDate.getHours();
}

/**
 * Converts a UTC date to a date in the specified timezone
 * @param date Date in UTC
 * @param timezone IANA timezone identifier (e.g., "America/New_York")
 * @returns Date in the specified timezone
 */
export function utcToLocal(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  return toZonedTime(date, timezone);
}

/**
 * Converts a date from the specified timezone to UTC
 * @param zonedDate Date in the specified timezone
 * @param timezone IANA timezone identifier (e.g., "America/New_York")
 * @returns Date in UTC
 */
export function localToUtc(
  zonedDate: Date,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  return fromZonedTime(zonedDate, timezone);
}

/**
 * Formats a UTC date as a string in the specified timezone
 * @param date Date in UTC
 * @param formatStr Format string compatible with date-fns
 * @param timezone IANA timezone identifier (e.g., "America/New_York")
 * @returns Formatted date string in the specified timezone
 */
export function formatLocalDate(
  date: Date,
  formatStr: string,
  timezone: string = DEFAULT_TIMEZONE,
): string {
  const zonedDate = toZonedTime(date, timezone);
  return format(zonedDate, formatStr);
}

/**
 * Gets the timezone offset in minutes for a given date and timezone
 * @param date The date to get the offset for
 * @param timezone IANA timezone identifier (e.g., "America/New_York")
 * @returns Timezone offset in minutes
 */
export function getLocalTimezoneOffset(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): number {
  return getTimezoneOffset(timezone, date) / (60 * 1000);
}

/**
 * Creates a Date object from a Unix timestamp (seconds) and converts to specified timezone
 * @param timestamp Unix timestamp in seconds
 * @param timezone IANA timezone identifier (e.g., "America/New_York")
 * @returns Date in the specified timezone
 */
export function timestampToLocalDate(
  timestamp: number,
  timezone: string = DEFAULT_TIMEZONE,
): Date {
  const utcDate = fromUnixTime(timestamp);
  return toZonedTime(utcDate, timezone);
}

/**
 * Format relative time (e.g., "2 hours ago")
 * This is timezone-agnostic since it compares to current time
 * @param date The date to format
 * @param options Options for formatting
 * @returns Relative time string
 */
export function formatRelativeTime(
  date: Date,
  options?: { addSuffix?: boolean },
): string {
  return formatDistanceToNow(date, { addSuffix: options?.addSuffix ?? true });
}
