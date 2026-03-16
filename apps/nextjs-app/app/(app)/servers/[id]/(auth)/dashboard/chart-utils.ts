/**
 * Shared constants and utilities for dashboard chart components.
 */

/** Common color palette used across transcoding chart cards. */
export const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#e11d48",
];

/**
 * Cleans up transcoding reason labels that may be stored as JSON arrays.
 * e.g. `["ContainerNotSupported"]` → `"ContainerNotSupported"`.
 */
export function cleanReasonLabel(label: string): string {
  if (label.startsWith("[") && label.endsWith("]")) {
    try {
      const parsed = JSON.parse(label);
      if (Array.isArray(parsed)) return parsed.join(", ");
    } catch (_error) {}
  }
  return label;
}
