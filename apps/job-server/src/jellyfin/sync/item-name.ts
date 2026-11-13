import type { JellyfinBaseItemDto } from "../client";

export const UNTITLED_ITEM_NAME = "Untitled";

// Name is declared required on the DTO, but Jellyfin omits it for some items
// (virtual specials, for one), so the input admits a missing or null Name.
type NamedItem = Pick<JellyfinBaseItemDto, "Type" | "IndexNumber"> & {
  Name?: string | null;
};

/**
 * items.name is NOT NULL, and an item Jellyfin sends without a name would
 * otherwise fail the whole batch it is inserted with.
 */
export function resolveItemName(item: NamedItem): string {
  const name = item.Name?.trim();
  if (name) {
    return name;
  }

  const index = item.IndexNumber;
  if (typeof index === "number") {
    if (item.Type === "Episode") {
      return `Episode ${index}`;
    }
    if (item.Type === "Season") {
      // Jellyfin keeps specials in season 0.
      return index === 0 ? "Specials" : `Season ${index}`;
    }
  }

  return UNTITLED_ITEM_NAME;
}
