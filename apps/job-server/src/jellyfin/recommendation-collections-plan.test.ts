import { describe, expect, test } from "bun:test";
import {
  collectionFolderName,
  collectionTagsFor,
  hideTagFor,
  membershipDiff,
  reconcileBlockedTags,
  sameTags,
} from "./recommendation-collections-plan";

const sarah = { id: "s1", name: "Sarah" };
const nullable = { id: "n1", name: "nullable.eth" };
const kids = { id: "k1", name: "Kids" };

describe("hideTagFor", () => {
  test("slugs the user name", () => {
    expect(hideTagFor(sarah)).toBe(".hide-from-sarah");
    expect(hideTagFor(nullable)).toBe(".hide-from-nullable-eth");
    expect(hideTagFor({ id: "x", name: "Zoë Ann" })).toBe(".hide-from-zoe-ann");
  });

  test("falls back to the id when the name has nothing usable", () => {
    expect(hideTagFor({ id: "abc123", name: "★★" })).toBe(".hide-from-abc123");
  });
});

describe("collectionTagsFor", () => {
  test("hides a user's collection from every other user, not the owner", () => {
    expect(collectionTagsFor(nullable, [sarah, nullable, kids])).toEqual([
      ".hide-from-kids",
      ".hide-from-sarah",
    ]);
  });

  test("never hides a collection from its owner on a name collision", () => {
    const twin = { id: "s2", name: "sarah!" };
    expect(collectionTagsFor(sarah, [sarah, twin])).toEqual([]);
  });

  test("creates each user's collection under a unique folder name", () => {
    expect(collectionFolderName(sarah)).toBe("AI Recommendations s1");
    expect(collectionFolderName(sarah)).not.toBe(collectionFolderName(nullable));
  });
});

describe("reconcileBlockedTags", () => {
  test("adds the user's own tag and keeps hand-set tags", () => {
    expect(reconcileBlockedTags([".noshare"], ".hide-from-sarah")).toEqual([
      ".noshare",
      ".hide-from-sarah",
    ]);
  });

  test("replaces a stale tag after a rename", () => {
    expect(
      reconcileBlockedTags([".noshare", ".hide-from-sara"], ".hide-from-sarah"),
    ).toEqual([".noshare", ".hide-from-sarah"]);
  });

  test("removes only our tags when disabling", () => {
    expect(reconcileBlockedTags([".noshare", ".hide-from-sarah"], null)).toEqual([
      ".noshare",
    ]);
  });

  test("is a no-op when already reconciled", () => {
    const current = [".noshare", ".hide-from-sarah"];
    expect(sameTags(current, reconcileBlockedTags(current, ".hide-from-sarah"))).toBe(
      true,
    );
  });
});

describe("membershipDiff", () => {
  test("adds new picks and drops ones no longer recommended", () => {
    expect(membershipDiff(["a", "b", "c"], ["b", "c", "d"])).toEqual({
      add: ["d"],
      remove: ["a"],
    });
  });
});
