import { format, fromUnixTime } from "date-fns";
import { fromZonedTime, toZonedTime, getTimezoneOffset } from "date-fns-tz";

// Get the timezone from environment or default to a sensible fallback
// Using server-specified timezone if available, otherwise defaulting to UTC
export const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE || process.env.TZ || "Etc/UTC";

/**
 * Converts a UTC hour to the local hour in the configured timezone
 * @param utcHour Hour in UTC (0-23)
 * @returns Hour in the configured timezone (0-23)
 */
export function utcHourToLocalHour(utcHour: number): number {
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
      0
    )
  );

  // Convert to the target timezone
  const zonedDate = toZonedTime(utcDate, TIMEZONE);
  return zonedDate.getHours();
}

/**
 * Converts a UTC date to a date in the configured timezone
 * @param date Date in UTC
 * @returns Date in the configured timezone
 */
export function utcToLocal(date: Date): Date {
  return toZonedTime(date, TIMEZONE);
}

/**
 * Converts a date from the configured timezone to UTC
 * @param zonedDate Date in the configured timezone
 * @returns Date in UTC
 */
export function localToUtc(zonedDate: Date): Date {
  return fromZonedTime(zonedDate, TIMEZONE);
}

/**
 * Formats a UTC date as a string in the configured timezone
 * @param date Date in UTC
 * @param formatStr Format string compatible with date-fns
 * @returns Formatted date string in the configured timezone
 */
export function formatLocalDate(date: Date, formatStr: string): string {
  const zonedDate = toZonedTime(date, TIMEZONE);
  return format(zonedDate, formatStr);
}

/**
 * Gets the timezone offset in minutes for a given date
 * @param date The date to get the offset for
 * @returns Timezone offset in minutes
 */
export function getLocalTimezoneOffset(date: Date): number {
  return getTimezoneOffset(TIMEZONE, date) / (60 * 1000);
}

/**
 * Creates a Date object from a Unix timestamp (seconds) and converts to local timezone
 * @param timestamp Unix timestamp in seconds
 * @returns Date in the configured timezone
 */
export function timestampToLocalDate(timestamp: number): Date {
  const utcDate = fromUnixTime(timestamp);
  return toZonedTime(utcDate, TIMEZONE);
}