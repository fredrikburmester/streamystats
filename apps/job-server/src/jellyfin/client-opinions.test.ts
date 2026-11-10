import { describe, expect, test } from "bun:test";
import { JellyfinClient } from "./client";

type Item = { Id: string; UserData: { IsFavorite: boolean; Likes: boolean | null } };

/** A client whose /Items responses come from `respond`, recording each call. */
function fakeClient(respond: (filter: string, startIndex: number, limit: number) => {
  Items: Item[];
  TotalRecordCount: number;
}) {
  const client = new JellyfinClient({ baseURL: "http://jellyfin.test", apiKey: "k" });
  const calls: { filter: string; startIndex: number; limit: number }[] = [];
  (client as unknown as { request: unknown }).request = async (
    _method: string,
    _url: string,
    options: { params: { Filters: string; StartIndex: number; Limit: number } },
  ) => {
    const { Filters, StartIndex, Limit } = options.params;
    calls.push({ filter: Filters, startIndex: StartIndex, limit: Limit });
    return respond(Filters, StartIndex, Limit);
  };
  return { client, calls };
}

const item = (id: string, IsFavorite: boolean, Likes: boolean | null): Item => ({
  Id: id,
  UserData: { IsFavorite, Likes },
});

describe("getUserOpinionItems", () => {
  test("collects favorites, likes and dislikes when filters are honored", async () => {
    const byFilter: Record<string, Item[]> = {
      IsFavorite: [item("fav", true, null), item("both", true, true)],
      Likes: [item("both", true, true), item("liked", false, true)],
      Dislikes: [item("disliked", false, false)],
    };
    const { client } = fakeClient((filter) => ({
      Items: byFilter[filter] ?? [],
      TotalRecordCount: (byFilter[filter] ?? []).length,
    }));
    const { items, unsupportedFilters } = await client.getUserOpinionItems("u");
    expect(items.map((i) => i.Id).sort()).toEqual(["both", "disliked", "fav", "liked"]);
    expect(unsupportedFilters).toEqual([]);
  });

  test("an unsupported filter costs one short request and contributes nothing", async () => {
    // Jellyfin 12: Dislikes answers with every item that is not liked, and
    // IsFavoriteOrLikes-style answers would put favorites under Likes.
    const library = Array.from({ length: 5000 }, (_, i) => item(`i${i}`, false, i === 3 ? false : null));
    const { client, calls } = fakeClient((filter, startIndex, limit) =>
      filter === "Dislikes"
        ? { Items: library.slice(startIndex, startIndex + limit), TotalRecordCount: library.length }
        : filter === "Likes"
          ? { Items: [item("liked", false, true)], TotalRecordCount: 1 }
          : { Items: [], TotalRecordCount: 0 },
    );
    const { items, unsupportedFilters } = await client.getUserOpinionItems("u", 1000, 50);
    expect(items.map((i) => i.Id)).toEqual(["liked"]);
    expect(unsupportedFilters).toEqual(["Dislikes"]);
    const dislikeCalls = calls.filter((c) => c.filter === "Dislikes");
    expect(dislikeCalls).toHaveLength(1);
    expect(dislikeCalls[0].limit).toBe(50);
  });

  test("pages through a large honored filter", async () => {
    const liked = Array.from({ length: 250 }, (_, i) => item(`l${i}`, false, true));
    const { client, calls } = fakeClient((filter, startIndex, limit) =>
      filter === "Likes"
        ? { Items: liked.slice(startIndex, startIndex + limit), TotalRecordCount: liked.length }
        : { Items: [], TotalRecordCount: 0 },
    );
    const { items } = await client.getUserOpinionItems("u", 100, 50);
    expect(items).toHaveLength(250);
    // a 50-item probe page, then full pages
    expect(calls.filter((c) => c.filter === "Likes").map((c) => c.limit)).toEqual([50, 100, 100]);
  });
});
