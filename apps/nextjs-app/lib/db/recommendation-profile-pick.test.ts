import { describe, expect, test } from "bun:test";
import {
  isThemeSeedId,
  MAX_THEMES,
  parseThemes,
  themeSeedCard,
  withMatchedThemes,
} from "./recommendation-profile-pick";

describe("parseThemes", () => {
  test("splits on commas, semicolons and new lines", () => {
    expect(
      parseThemes(
        "AI, quantum physics; time travel\npost-apocalyptic survival",
      ),
    ).toEqual([
      "AI",
      "quantum physics",
      "time travel",
      "post-apocalyptic survival",
    ]);
  });

  test("trims, collapses whitespace and drops empty or repeated themes", () => {
    expect(parseThemes("  time   travel ,, Time Travel,\n\n")).toEqual([
      "time travel",
    ]);
  });

  test("caps the number of themes", () => {
    const many = Array.from({ length: MAX_THEMES + 5 }, (_, i) => `t${i}`).join(
      ",",
    );
    expect(parseThemes(many)).toHaveLength(MAX_THEMES);
  });
});

describe("theme seeds", () => {
  test("are shaped like item cards with reserved ids", () => {
    const card = themeSeedCard(
      { text: "time travel", embedding: [0.1, 0.2] },
      2,
    );
    expect(card.id).toBe("theme:2");
    expect(card.name).toBe("time travel");
    expect(card.embedding).toEqual([0.1, 0.2]);
    expect(isThemeSeedId(card.id)).toBe(true);
    expect(isThemeSeedId("2a8b25cc3374e60b15d88262876ef9d3")).toBe(false);
  });

  test("move from basedOn (item links) to matchedThemes", () => {
    const rec = {
      item: { id: "x" },
      basedOn: [
        { id: "theme:0", name: "time travel" },
        { id: "movie-1", name: "Primer" },
      ],
    };
    const result = withMatchedThemes(rec);
    expect(result.basedOn).toEqual([{ id: "movie-1", name: "Primer" }]);
    expect(result.matchedThemes).toEqual(["time travel"]);
  });
});
