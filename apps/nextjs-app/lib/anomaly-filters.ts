export const ANOMALY_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export type AnomalySeverity = (typeof ANOMALY_SEVERITIES)[number];

/**
 * The filters of the anomalies page. The list, its count and "mark all as
 * resolved" all read the same object, so resolving never reaches anomalies
 * the page is not showing.
 */
export interface AnomalyFilters {
  resolved?: boolean;
  severity?: AnomalySeverity;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface AnomalyFilterParams {
  resolved?: string;
  severity?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

function isAnomalySeverity(value: string): value is AnomalySeverity {
  return ANOMALY_SEVERITIES.some((severity) => severity === value);
}

function parseDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // An unparseable date would reach Postgres as "Invalid Date" and fail the
  // whole query, so it is dropped like any other unknown filter value.
  return Number.isNaN(new Date(value).getTime()) ? undefined : value;
}

/**
 * Turns the page's search params into filters, dropping values the page
 * cannot have produced.
 */
export function parseAnomalyFilters(
  params: AnomalyFilterParams,
): AnomalyFilters {
  const filters: AnomalyFilters = {};

  if (params.resolved === "true") filters.resolved = true;
  if (params.resolved === "false") filters.resolved = false;

  if (params.severity && isAnomalySeverity(params.severity)) {
    filters.severity = params.severity;
  }

  if (params.userId) filters.userId = params.userId;

  const dateFrom = parseDate(params.dateFrom);
  if (dateFrom) filters.dateFrom = dateFrom;

  const dateTo = parseDate(params.dateTo);
  if (dateTo) filters.dateTo = dateTo;

  return filters;
}

/**
 * The filters "mark all as resolved" acts on: everything the page shows that
 * is still open. Filtering on resolved anomalies leaves nothing to resolve.
 */
export function unresolvedAnomalyFilters(
  filters: AnomalyFilters,
): AnomalyFilters | null {
  if (filters.resolved === true) return null;
  return { ...filters, resolved: false };
}
