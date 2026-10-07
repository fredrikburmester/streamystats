import { sql, type SQL } from "drizzle-orm";
import { items, userItemRatings } from "./schema";

/**
 * Items that get an embedding: every movie and series, plus any episode
 * someone has rated. Embedding the whole episode catalogue would multiply the
 * work for little gain, but a rated episode says which *content* a viewer
 * liked (one standout episode of a series they are lukewarm on), which only
 * that episode's own embedding can capture.
 */
export function embeddableItemCondition(): SQL {
  return sql`(${items.type} IN ('Movie', 'Series') OR (${items.type} = 'Episode' AND EXISTS (SELECT 1 FROM ${userItemRatings} WHERE ${userItemRatings.itemId} = ${items.id})))`;
}
