/**
 * Genre normalization utilities for case-insensitive and synonym-aware aggregation.
 */

/**
 * Maps genre synonyms to their canonical form.
 * Keys are lowercase, values are the preferred display name.
 */
const GENRE_SYNONYMS: Record<string, string> = {
  "sci-fi": "Science Fiction",
  scifi: "Science Fiction",
  "science-fiction": "Science Fiction",
  romcom: "Romantic Comedy",
  "rom-com": "Romantic Comedy",
  docs: "Documentary",
  documentaries: "Documentary",
};

/**
 * Normalizes a genre string for aggregation purposes.
 * Returns a lowercase key for grouping and the best display name.
 */
export function normalizeGenre(genre: string): {
  key: string;
  displayName: string;
} {
  const lowerGenre = genre.toLowerCase();

  // Check if it's a known synonym
  const canonical = GENRE_SYNONYMS[lowerGenre];
  if (canonical) {
    return { key: canonical.toLowerCase(), displayName: canonical };
  }

  // Default: use lowercase as key, original as display
  return { key: lowerGenre, displayName: genre };
}

/**
 * Returns true if the new display name is "better" than the existing one.
 * Prefers capitalized names (e.g., "Thriller" over "thriller").
 */
export function isBetterDisplayName(
  existing: string,
  candidate: string,
): boolean {
  const existingCapitalized = existing[0] === existing[0].toUpperCase();
  const candidateCapitalized = candidate[0] === candidate[0].toUpperCase();
  return candidateCapitalized && !existingCapitalized;
}
