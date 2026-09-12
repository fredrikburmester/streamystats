/**
 * Jellyfin exposes alternate versions of a movie (and, since Jellyfin 12, of
 * an episode) as hidden items: the library listing shows one item whose
 * MediaSources carry the ids of every version, but a client that plays the
 * secondary version reports that hidden id as NowPlayingItem.Id. Sessions must
 * be stored against the listed item, so the id is resolved through the media
 * sources that items sync already persists, with a live Jellyfin lookup as the
 * last resort for versions added after the last sync.
 */
export interface SessionItemLookups {
  itemExists(itemId: string): Promise<boolean>;
  itemIdForMediaSource(mediaSourceId: string): Promise<string | null>;
  /** Media source ids Jellyfin reports for the item, empty when unavailable. */
  fetchMediaSourceIds(itemId: string): Promise<string[]>;
}

export type SessionItemResolution =
  | "item"
  | "media-source"
  | "jellyfin"
  | "unresolved";

export interface ResolvedSessionItem {
  itemId: string;
  resolvedVia: SessionItemResolution;
}

export async function resolveSessionItemId(args: {
  nowPlayingItemId: string;
  mediaSourceId?: string;
  lookups: SessionItemLookups;
}): Promise<ResolvedSessionItem> {
  const { nowPlayingItemId, mediaSourceId, lookups } = args;

  if (await lookups.itemExists(nowPlayingItemId)) {
    return { itemId: nowPlayingItemId, resolvedVia: "item" };
  }

  const localCandidates = uniqueIds([nowPlayingItemId, mediaSourceId]);
  for (const candidate of localCandidates) {
    const parentItemId = await lookups.itemIdForMediaSource(candidate);
    if (parentItemId) {
      return { itemId: parentItemId, resolvedVia: "media-source" };
    }
  }

  const remoteCandidates = (await lookups.fetchMediaSourceIds(nowPlayingItemId)).filter(
    (id) => !localCandidates.includes(id)
  );
  for (const candidate of remoteCandidates) {
    if (await lookups.itemExists(candidate)) {
      return { itemId: candidate, resolvedVia: "jellyfin" };
    }
    const parentItemId = await lookups.itemIdForMediaSource(candidate);
    if (parentItemId) {
      return { itemId: parentItemId, resolvedVia: "jellyfin" };
    }
  }

  return { itemId: nowPlayingItemId, resolvedVia: "unresolved" };
}

function uniqueIds(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    if (value) seen.add(value);
  }
  return Array.from(seen);
}
