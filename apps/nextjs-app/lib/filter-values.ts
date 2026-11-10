/**
 * Multi-value filters in a single query parameter.
 *
 * `?userId=a,b` keeps only `a` and `b`; `?userId=!a` keeps everything except
 * `a`. The two are not interchangeable: an exclusion also keeps values that
 * are not listed anywhere (a user added later, a session with no device
 * name), so the mode records what the person did — unticking from "all" is
 * an exclusion, ticking from "none" is an inclusion. Each value is
 * URI-encoded before joining so names containing commas or a leading "!"
 * survive. A plain legacy value (`?userId=a`) still parses as an inclusion.
 */
export interface ValueFilter {
  mode: "include" | "exclude";
  values: string[];
}

/** Every value: nothing excluded. */
export const ALL_VALUES: ValueFilter = { mode: "exclude", values: [] };

const encodeValue = (value: string) =>
  encodeURIComponent(value).replace(/!/g, "%21");

const decodeValue = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

export function parseValueFilter(
  raw: string | null | undefined,
): ValueFilter | undefined {
  if (!raw || raw === "all") return undefined;
  const exclude = raw.startsWith("!");
  const values = [
    ...new Set(
      (exclude ? raw.slice(1) : raw)
        .split(",")
        .map((part) => decodeValue(part.trim()))
        .filter((part) => part.length > 0),
    ),
  ];
  if (values.length === 0) return undefined;
  return { mode: exclude ? "exclude" : "include", values };
}

/**
 * The parameter value for a filter, or null when it keeps everything. An
 * empty inclusion (everything unticked) and an inclusion of every option are
 * treated as everything too.
 */
export function formatValueFilter(
  filter: ValueFilter,
  options: readonly string[],
): string | null {
  const values = [...new Set(filter.values)];
  if (values.length === 0) return null;
  if (
    filter.mode === "include" &&
    options.length > 0 &&
    options.every((option) => values.includes(option))
  ) {
    return null;
  }
  const encoded = values.map(encodeValue).join(",");
  return filter.mode === "exclude" ? `!${encoded}` : encoded;
}

export function isSelected(filter: ValueFilter, value: string): boolean {
  const listed = filter.values.includes(value);
  return filter.mode === "include" ? listed : !listed;
}

/** Tick or untick one value. */
export function toggleValue(filter: ValueFilter, value: string): ValueFilter {
  const values = filter.values.includes(value)
    ? filter.values.filter((v) => v !== value)
    : [...filter.values, value];
  return { mode: filter.mode, values };
}

/** Whether every one of `options` is ticked. */
export function allSelected(
  filter: ValueFilter,
  options: readonly string[],
): boolean {
  return options.every((option) => isSelected(filter, option));
}
