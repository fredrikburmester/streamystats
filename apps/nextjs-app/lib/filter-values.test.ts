import { describe, expect, test } from "bun:test";
import {
  ALL_VALUES,
  allSelected,
  formatValueFilter,
  isSelected,
  parseValueFilter,
  toggleValue,
} from "./filter-values";

const users = ["erika", "me", "sarah", "tom"];

describe("unticking from all is an exclusion", () => {
  test("everyone except me", () => {
    const filter = toggleValue(ALL_VALUES, "me");
    expect(formatValueFilter(filter, users)).toBe("!me");
    expect(users.filter((u) => isSelected(filter, u))).toEqual([
      "erika",
      "sarah",
      "tom",
    ]);
  });

  test("stays an exclusion even when most values are unticked", () => {
    // Two devices, untick one: still "everything except Chrome", which
    // also keeps sessions with no device name.
    const filter = toggleValue(ALL_VALUES, "Chrome");
    expect(formatValueFilter(filter, ["Chrome", "SHIELD"])).toBe("!Chrome");
  });

  test("re-ticking everything is no filter", () => {
    const filter = toggleValue(toggleValue(ALL_VALUES, "me"), "me");
    expect(formatValueFilter(filter, users)).toBeNull();
  });
});

describe("ticking from none is an inclusion", () => {
  const none = { mode: "include" as const, values: [] };

  test("only two users", () => {
    const filter = toggleValue(toggleValue(none, "tom"), "erika");
    expect(formatValueFilter(filter, users)).toBe("tom,erika");
  });

  test("nothing ticked, or every option ticked, is no filter", () => {
    expect(formatValueFilter(none, users)).toBeNull();
    expect(
      formatValueFilter({ mode: "include", values: users }, users),
    ).toBeNull();
    expect(allSelected({ mode: "include", values: users }, users)).toBe(true);
  });
});

describe("encoding", () => {
  test("commas and a leading bang survive a round trip", () => {
    const filter = {
      mode: "include" as const,
      values: ["Samsung, TV", "!weird"],
    };
    const raw = formatValueFilter(filter, ["Samsung, TV", "!weird", "Chrome"]);
    expect(parseValueFilter(raw)).toEqual(filter);
    const excluded = { mode: "exclude" as const, values: ["Samsung, TV"] };
    expect(parseValueFilter(formatValueFilter(excluded, []))).toEqual(excluded);
  });
});

describe("parseValueFilter", () => {
  test("absent, empty and 'all' are no filter", () => {
    expect(parseValueFilter(undefined)).toBeUndefined();
    expect(parseValueFilter("")).toBeUndefined();
    expect(parseValueFilter("all")).toBeUndefined();
    expect(parseValueFilter("!")).toBeUndefined();
  });

  test("a legacy single value is an inclusion", () => {
    expect(parseValueFilter("Jellyfin Web")).toEqual({
      mode: "include",
      values: ["Jellyfin Web"],
    });
  });

  test("exclusions and de-duplication", () => {
    expect(parseValueFilter("!a,b,a")).toEqual({
      mode: "exclude",
      values: ["a", "b"],
    });
  });

  test("an exclusion keeps values added later", () => {
    const filter = parseValueFilter("!me");
    expect(filter && isSelected(filter, "newcomer")).toBe(true);
  });
});
