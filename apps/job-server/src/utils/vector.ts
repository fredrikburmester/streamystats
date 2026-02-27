/**
 * Shared vector math utilities for embedding jobs.
 */

/**
 * Normalize a vector to unit length.
 * Returns the original vector if the norm is near-zero (< 1e-10).
 */
export function normalizeVector(vec: number[]): number[] {
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm);
  if (norm < 1e-10) return vec;
  return vec.map((v) => v / norm);
}

/**
 * Convert a number array to a pgvector literal string, e.g. `[0.1,0.2,0.3]`.
 */
export function toPgVectorLiteral(value: number[]): string {
  return `[${value.join(",")}]`;
}
