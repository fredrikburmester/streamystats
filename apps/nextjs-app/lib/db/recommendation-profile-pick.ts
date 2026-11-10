/** Taste themes are short phrases; a few is plenty to steer by. */
export const MAX_THEMES = 12;
const MAX_THEME_LENGTH = 80;

/** Seeds for themes use reserved ids so they never collide with item ids. */
export const THEME_SEED_PREFIX = "theme:";

export interface ThemeLike {
  text: string;
  embedding: number[];
}

/**
 * "AI, quantum physics; time travel\npost-apocalyptic" -> four themes.
 * Each theme becomes its own seed, so distinct interests are not averaged
 * into one vague one.
 */
export function parseThemes(text: string): string[] {
  const seen = new Set<string>();
  const themes: string[] = [];
  for (const part of text.split(/[,;\n]+/)) {
    const theme = part.trim().replace(/\s+/g, " ").slice(0, MAX_THEME_LENGTH);
    const key = theme.toLowerCase();
    if (!theme || seen.has(key)) continue;
    seen.add(key);
    themes.push(theme);
    if (themes.length >= MAX_THEMES) break;
  }
  return themes;
}

export function isThemeSeedId(id: string): boolean {
  return id.startsWith(THEME_SEED_PREFIX);
}

/**
 * A theme as a recommendation seed: shaped like an item card so the engine
 * treats it like any other seed, with no image or metadata of its own.
 */
export function themeSeedCard(theme: ThemeLike, index: number) {
  return {
    id: `${THEME_SEED_PREFIX}${index}`,
    name: theme.text,
    type: "Theme",
    productionYear: null,
    runtimeTicks: null,
    genres: null,
    communityRating: null,
    primaryImageTag: null,
    primaryImageThumbTag: null,
    primaryImageLogoTag: null,
    backdropImageTags: null,
    seriesId: null,
    seriesPrimaryImageTag: null,
    parentBackdropItemId: null,
    parentBackdropImageTags: null,
    parentThumbItemId: null,
    parentThumbImageTag: null,
    embedding: theme.embedding,
  };
}

/**
 * Move theme seeds out of `basedOn` (which links to library items) into
 * `matchedThemes` (shown as text).
 */
export function withMatchedThemes<
  T extends { basedOn: { id: string; name: string }[] },
>(rec: T): T & { matchedThemes: string[] } {
  const matchedThemes = rec.basedOn
    .filter((item) => isThemeSeedId(item.id))
    .map((item) => item.name);
  return {
    ...rec,
    basedOn: rec.basedOn.filter((item) => !isThemeSeedId(item.id)),
    matchedThemes,
  };
}
