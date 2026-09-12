import { describe, expect, test } from "bun:test";
import {
  resolveSessionItemId,
  type SessionItemLookups,
} from "./session-item-resolver";

const LISTED_MOVIE = "5b6bb8fdae0db9808e4491b967198099";
const HIDDEN_720P_VERSION = "345c763aa9d22ad06729fc417acc3922";

function fakeLookups(overrides: Partial<SessionItemLookups> & {
  items?: string[];
  mediaSources?: Record<string, string>;
  remote?: Record<string, string[]>;
}): SessionItemLookups & { calls: string[] } {
  const items = new Set(overrides.items ?? []);
  const mediaSources = overrides.mediaSources ?? {};
  const remote = overrides.remote ?? {};
  const calls: string[] = [];
  return {
    calls,
    itemExists: async (id) => {
      calls.push(`item:${id}`);
      return items.has(id);
    },
    itemIdForMediaSource: async (id) => {
      calls.push(`source:${id}`);
      return mediaSources[id] ?? null;
    },
    fetchMediaSourceIds: async (id) => {
      calls.push(`remote:${id}`);
      return remote[id] ?? [];
    },
    ...overrides,
  };
}

describe("resolveSessionItemId", () => {
  test("keeps the id when the item is already synced", async () => {
    const lookups = fakeLookups({ items: [LISTED_MOVIE] });

    const result = await resolveSessionItemId({
      nowPlayingItemId: LISTED_MOVIE,
      lookups,
    });

    expect(result).toEqual({ itemId: LISTED_MOVIE, resolvedVia: "item" });
    expect(lookups.calls).toEqual([`item:${LISTED_MOVIE}`]);
  });

  test("maps a hidden alternate version through synced media sources", async () => {
    const lookups = fakeLookups({
      items: [LISTED_MOVIE],
      mediaSources: {
        [LISTED_MOVIE]: LISTED_MOVIE,
        [HIDDEN_720P_VERSION]: LISTED_MOVIE,
      },
    });

    const result = await resolveSessionItemId({
      nowPlayingItemId: HIDDEN_720P_VERSION,
      mediaSourceId: HIDDEN_720P_VERSION,
      lookups,
    });

    expect(result).toEqual({ itemId: LISTED_MOVIE, resolvedVia: "media-source" });
    expect(lookups.calls).not.toContain(`remote:${HIDDEN_720P_VERSION}`);
  });

  test("uses the PlayState media source id when the item id is unknown", async () => {
    const lookups = fakeLookups({
      items: [LISTED_MOVIE],
      mediaSources: { [HIDDEN_720P_VERSION]: LISTED_MOVIE },
    });

    const result = await resolveSessionItemId({
      nowPlayingItemId: "not-synced-anywhere",
      mediaSourceId: HIDDEN_720P_VERSION,
      lookups,
    });

    expect(result).toEqual({ itemId: LISTED_MOVIE, resolvedVia: "media-source" });
  });

  test("falls back to Jellyfin's media source list for versions added after the last sync", async () => {
    const lookups = fakeLookups({
      items: [LISTED_MOVIE],
      remote: { [HIDDEN_720P_VERSION]: [HIDDEN_720P_VERSION, LISTED_MOVIE] },
    });

    const result = await resolveSessionItemId({
      nowPlayingItemId: HIDDEN_720P_VERSION,
      lookups,
    });

    expect(result).toEqual({ itemId: LISTED_MOVIE, resolvedVia: "jellyfin" });
  });

  test("returns the original id unchanged when nothing matches", async () => {
    const lookups = fakeLookups({});

    const result = await resolveSessionItemId({
      nowPlayingItemId: HIDDEN_720P_VERSION,
      mediaSourceId: HIDDEN_720P_VERSION,
      lookups,
    });

    expect(result).toEqual({
      itemId: HIDDEN_720P_VERSION,
      resolvedVia: "unresolved",
    });
    expect(lookups.calls).toContain(`remote:${HIDDEN_720P_VERSION}`);
  });

  test("survives a failing Jellyfin lookup that yields no ids", async () => {
    const lookups = fakeLookups({
      fetchMediaSourceIds: async () => [],
    });

    const result = await resolveSessionItemId({
      nowPlayingItemId: HIDDEN_720P_VERSION,
      lookups,
    });

    expect(result.resolvedVia).toBe("unresolved");
  });
});
