"use client";

import { formatLocalDate, formatRelativeTime } from "@/lib/timezone";
import { useServerTimezone } from "@/providers/ServerTimezoneProvider";

// Preset format strings for common use cases
export const DATE_FORMATS = {
  date: "d MMM yyyy", // "15 Jan 2025"
  time: "HH:mm", // "14:30"
  datetime: "d MMM yyyy, HH:mm", // "15 Jan 2025, 14:30"
  datetimeShort: "d MMM, HH:mm", // "15 Jan, 14:30"
  full: "EEEE, d MMMM yyyy, HH:mm:ss", // "Wednesday, 15 January 2025, 14:30:45"
  monthYear: "MMMM yyyy", // "January 2025"
  dayMonth: "d MMM", // "15 Jan"
  iso: "yyyy-MM-dd", // "2025-01-15"
} as const;

type DateFormatPreset = keyof typeof DATE_FORMATS;

interface FormattedDateProps {
  /** The date to format (Date object, ISO string, or timestamp) */
  date: Date | string | number | null | undefined;
  /** Format preset or custom date-fns format string */
  format?: DateFormatPreset | string;
  /** Use relative time formatting (e.g., "2 hours ago") */
  relative?: boolean;
  /** Override the server timezone for this instance */
  timezone?: string;
  /** Fallback text when date is null/undefined */
  fallback?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A component that formats dates according to the server's configured timezone.
 * Uses the ServerTimezoneProvider context to get the current timezone.
 *
 * @example
 * // Basic usage - uses server timezone
 * <FormattedDate date={session.startTime} />
 *
 * @example
 * // With format preset
 * <FormattedDate date={session.startTime} format="date" />
 *
 * @example
 * // Relative time
 * <FormattedDate date={session.startTime} relative />
 *
 * @example
 * // Custom format string
 * <FormattedDate date={session.startTime} format="yyyy-MM-dd HH:mm:ss" />
 */
export function FormattedDate({
  date,
  format = "datetime",
  relative = false,
  timezone: overrideTimezone,
  fallback = "\u2014",
  className,
}: FormattedDateProps) {
  const serverTimezone = useServerTimezone();
  const effectiveTimezone = overrideTimezone ?? serverTimezone;

  if (date === null || date === undefined) {
    return <span className={className}>{fallback}</span>;
  }

  // Convert to Date object
  let dateObj: Date;
  if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === "string") {
    dateObj = new Date(date);
  } else if (typeof date === "number") {
    // Assume Unix timestamp in seconds if < 10^12, otherwise milliseconds
    dateObj = new Date(date < 1e12 ? date * 1000 : date);
  } else {
    return <span className={className}>{fallback}</span>;
  }

  // Validate the date
  if (Number.isNaN(dateObj.getTime())) {
    return <span className={className}>{fallback}</span>;
  }

  // Format the date
  let formatted: string;
  if (relative) {
    formatted = formatRelativeTime(dateObj);
  } else {
    const formatStr =
      DATE_FORMATS[format as DateFormatPreset] ?? (format as string);
    formatted = formatLocalDate(dateObj, formatStr, effectiveTimezone);
  }

  // Include title with full datetime for accessibility
  const titleFormat = DATE_FORMATS.full;
  const title = formatLocalDate(dateObj, titleFormat, effectiveTimezone);

  return (
    <time dateTime={dateObj.toISOString()} title={title} className={className}>
      {formatted}
    </time>
  );
}
