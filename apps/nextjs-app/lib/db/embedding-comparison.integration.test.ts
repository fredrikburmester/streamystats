import { describe, expect, test } from "bun:test";
import { items } from "@streamystats/database/schema";
import { and, asc, isNotNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getItemEmbeddingComparison } from "./embedding-comparison";

const testDatabaseUrl = process.env.STREAMYSTATS_TEST_DATABASE_URL;

describe.skipIf(!testDatabaseUrl)("indexed embedding comparison", () => {
  test("ranks matching dimensions and uses the partial HNSW index", async () => {
    if (
      !testDatabaseUrl ||
      !new URL(testDatabaseUrl).pathname.endsWith("_test")
    ) {
      throw new Error("Use a dedicated database ending in _test");
    }

    const client = postgres(testDatabaseUrl, { max: 1 });
    const db = drizzle(client);
    try {
      await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector`);
      await db.transaction(async (transaction) => {
        // The temporary table shadows the application table on this connection.
        await transaction.execute(
          sql`CREATE TEMPORARY TABLE items (id text, embedding vector) ON COMMIT DROP`,
        );
        await transaction.execute(sql`
          INSERT INTO items VALUES
            ('nearest', '[1,0,0]'),
            ('orthogonal', '[0,1,0]'),
            ('opposite', '[-1,0,0]'),
            ('other-dimensions', '[1,0]'),
            ('missing', NULL)
        `);
        await transaction.execute(sql`
          CREATE INDEX embedding_comparison_test_idx ON items
          USING hnsw ((embedding::vector(3)) vector_cosine_ops)
          WHERE embedding IS NOT NULL AND vector_dims(embedding) = 3
        `);

        const { distance, dimensionFilter } = getItemEmbeddingComparison([
          1, 0, 0,
        ]);
        const query = transaction
          .select({ id: items.id, distance })
          .from(items)
          .where(and(isNotNull(items.embedding), dimensionFilter))
          .orderBy(asc(distance))
          .limit(3);

        expect(await query).toEqual([
          { id: "nearest", distance: 0 },
          { id: "orthogonal", distance: 1 },
          { id: "opposite", distance: 2 },
        ]);

        // Force the index on this tiny fixture and verify prepared generic plans
        // can still prove the partial-index predicate.
        await transaction.execute(sql`SET LOCAL enable_seqscan = off`);
        await transaction.execute(
          sql`SET LOCAL plan_cache_mode = force_generic_plan`,
        );
        const plan = await transaction.execute(
          sql`EXPLAIN (FORMAT JSON) ${query}`,
        );
        expect(JSON.stringify(plan)).toContain("embedding_comparison_test_idx");
        expect(await query).toHaveLength(3);
      });
    } finally {
      await client.end();
    }
  });
});
