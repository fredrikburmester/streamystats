import { describe, expect, test } from "bun:test";
import {
  parseAnomalyFilters,
  unresolvedAnomalyFilters,
} from "./anomaly-filters";

describe("parseAnomalyFilters", () => {
  test("no params is no filter", () => {
    expect(parseAnomalyFilters({})).toEqual({});
  });

  test("keeps every filter the page can set", () => {
    expect(
      parseAnomalyFilters({
        resolved: "false",
        severity: "high",
        userId: "user-1",
        dateFrom: "2025-07-01T00:00:00.000Z",
        dateTo: "2025-07-31T23:59:59.999Z",
      }),
    ).toEqual({
      resolved: false,
      severity: "high",
      userId: "user-1",
      dateFrom: "2025-07-01T00:00:00.000Z",
      dateTo: "2025-07-31T23:59:59.999Z",
    });
  });

  test("reads resolved as a boolean", () => {
    expect(parseAnomalyFilters({ resolved: "true" })).toEqual({
      resolved: true,
    });
    expect(parseAnomalyFilters({ resolved: "all" })).toEqual({});
  });

  test("drops values the page cannot produce", () => {
    expect(
      parseAnomalyFilters({
        severity: "extreme",
        userId: "",
        dateFrom: "not a date",
        dateTo: "",
      }),
    ).toEqual({});
  });
});

describe("unresolvedAnomalyFilters", () => {
  test("narrows the page filters to open anomalies", () => {
    expect(unresolvedAnomalyFilters({ severity: "critical" })).toEqual({
      severity: "critical",
      resolved: false,
    });
  });

  test("keeps the user and date filters", () => {
    expect(
      unresolvedAnomalyFilters({
        userId: "user-1",
        dateFrom: "2025-07-01T00:00:00.000Z",
        resolved: false,
      }),
    ).toEqual({
      userId: "user-1",
      dateFrom: "2025-07-01T00:00:00.000Z",
      resolved: false,
    });
  });

  test("nothing to resolve when only resolved anomalies are shown", () => {
    expect(unresolvedAnomalyFilters({ resolved: true })).toBeNull();
  });
});
