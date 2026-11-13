import { describe, expect, test } from "bun:test";
import { resolveItemName } from "./item-name";

describe("resolveItemName", () => {
  test("keeps the name Jellyfin sends", () => {
    expect(resolveItemName({ Name: "Pilot", Type: "Episode", IndexNumber: 1 })).toBe(
      "Pilot"
    );
  });

  test("trims the name", () => {
    expect(resolveItemName({ Name: "  Pilot  ", Type: "Episode" })).toBe("Pilot");
  });

  // A virtual special from issue #597: LocationType Virtual, no Name.
  test("names an episode without a name by its number", () => {
    expect(resolveItemName({ Type: "Episode", IndexNumber: 3 })).toBe("Episode 3");
  });

  test("treats a blank or null name as missing", () => {
    expect(resolveItemName({ Name: "   ", Type: "Episode", IndexNumber: 0 })).toBe(
      "Episode 0"
    );
    expect(resolveItemName({ Name: null, Type: "Episode", IndexNumber: 2 })).toBe(
      "Episode 2"
    );
  });

  test("names a season without a name by its number", () => {
    expect(resolveItemName({ Type: "Season", IndexNumber: 2 })).toBe("Season 2");
    expect(resolveItemName({ Type: "Season", IndexNumber: 0 })).toBe("Specials");
  });

  test("falls back to Untitled when there is nothing to go on", () => {
    expect(resolveItemName({ Type: "Episode" })).toBe("Untitled");
    expect(resolveItemName({ Type: "Movie", IndexNumber: 4 })).toBe("Untitled");
  });
});
