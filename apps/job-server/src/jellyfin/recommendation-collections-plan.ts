/**
 * Visibility for per-user recommendation collections.
 *
 * Jellyfin has no per-collection permissions, but parental control can block
 * items by tag, and that applies to collections themselves. Each user's
 * collection is tagged `.hide-from-<other>` for every other user, and each
 * user blocks only their own `.hide-from-<self>` tag: one blocked tag per
 * user, however many users there are.
 */
export const HIDE_TAG_PREFIX = ".hide-from-";
export const COLLECTION_SIZE = 30;

export interface CollectionUser {
  id: string;
  name: string;
}

/** What every user sees; each only ever sees their own collection. */
export const COLLECTION_DISPLAY_NAME = "AI Recommendations";

/**
 * The name a collection is created with. Jellyfin keeps each collection in a
 * folder named after it, so this stays unique per user; the displayed name is
 * then set to COLLECTION_DISPLAY_NAME.
 */
export function collectionFolderName(user: CollectionUser): string {
  return `AI Recommendations ${user.id}`;
}

/** `.hide-from-<slug>`; falls back to the user id when the name has no usable characters. */
export function hideTagFor(user: CollectionUser): string {
  const slug = user.name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${HIDE_TAG_PREFIX}${slug || user.id}`;
}

/** Tags for `owner`'s collection: hidden from every other user. */
export function collectionTagsFor(
  owner: CollectionUser,
  users: CollectionUser[],
): string[] {
  const ownTag = hideTagFor(owner);
  const tags = new Set<string>();
  for (const user of users) {
    if (user.id === owner.id) continue;
    const tag = hideTagFor(user);
    // A name collision would also hide the owner's collection from the owner.
    if (tag !== ownTag) tags.add(tag);
  }
  return [...tags].sort();
}

/**
 * A user's blocked tags with exactly their own hide tag among ours (`null`
 * when disabling: all of ours removed). Tags the admin set by hand are kept.
 */
export function reconcileBlockedTags(
  current: string[],
  ownTag: string | null,
): string[] {
  const kept = current.filter((tag) => !tag.startsWith(HIDE_TAG_PREFIX));
  return ownTag ? [...kept, ownTag] : kept;
}

export function sameTags(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((tag, i) => tag === sortedB[i]);
}

/** Members to add and remove to make a collection hold exactly `wanted`. */
export function membershipDiff(
  current: string[],
  wanted: string[],
): { add: string[]; remove: string[] } {
  const currentSet = new Set(current);
  const wantedSet = new Set(wanted);
  return {
    add: wanted.filter((id) => !currentSet.has(id)),
    remove: current.filter((id) => !wantedSet.has(id)),
  };
}
