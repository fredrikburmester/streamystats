"use server";

import { db, items, sessions } from "@streamystats/database";
import { and, desc, eq, isNotNull, sql, sum } from "drizzle-orm";

export interface TasteProfile {
  userId: string;
  userName: string;
  embedding: number[] | null;
  genreWeights: Record<string, number>;
  topItems: Array<{
    id: string;
    name: string;
    type: string;
    embedding: number[] | null;
    watchTime: number;
  }>;
  totalWatchTime: number;
  itemCount: number;
  visualSeed: number;
  dominantHue: number;
  secondaryHue: number;
  complexity: number;
}

// Compute visual properties from the average embedding (colors, seed)
function computeVisualProperties(embedding: number[]): {
  dominantHue: number;
  secondaryHue: number;
  visualSeed: number;
} {
  if (!embedding || embedding.length === 0) {
    return {
      dominantHue: 200,
      secondaryHue: 280,
      visualSeed: 0,
    };
  }

  const firstQuarter = embedding.slice(0, Math.floor(embedding.length / 4));
  const secondQuarter = embedding.slice(
    Math.floor(embedding.length / 4),
    Math.floor(embedding.length / 2),
  );

  const avgFirst =
    firstQuarter.reduce((a, b) => a + b, 0) / firstQuarter.length;
  const dominantHue = Math.abs(((avgFirst + 1) / 2) * 360) % 360;

  const avgSecond =
    secondQuarter.reduce((a, b) => a + b, 0) / secondQuarter.length;
  const secondaryHue = Math.abs(((avgSecond + 1) / 2) * 360) % 360;

  const visualSeed = Math.abs(
    embedding
      .slice(0, 8)
      .reduce((acc, val, i) => acc + val * (i + 1) * 1000, 0),
  );

  return { dominantHue, secondaryHue, visualSeed };
}

// Calculate cosine distance between two embeddings
function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return 1;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  return 1 - similarity; // Convert to distance
}

// Compute taste complexity: how diverse/eclectic the watched content is
// Low = focused taste (all similar content), High = eclectic (varied content)
function computeComplexity(
  itemEmbeddings: number[][],
  centroid: number[],
): number {
  if (itemEmbeddings.length < 2) return 0.5;

  // Calculate average distance from centroid
  let totalDistance = 0;
  for (const emb of itemEmbeddings) {
    totalDistance += cosineDistance(emb, centroid);
  }
  const avgDistance = totalDistance / itemEmbeddings.length;

  // Cosine distance ranges from 0 (identical) to 2 (opposite)
  // Typical values for similar content: 0.1-0.4
  // Typical values for diverse content: 0.4-0.8
  // Scale to 0-1 range with reasonable distribution
  const complexity = Math.min(1, Math.max(0, avgDistance * 2));

  return complexity;
}

export async function getUserTasteProfile(
  serverId: number,
  userId: string,
  userName: string,
): Promise<TasteProfile> {
  // Get total watch time from ALL sessions (not just ones with embeddings)
  const totalWatchTimeResult = await db
    .select({
      total: sum(sessions.playDuration),
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.userId, userId),
        isNotNull(sessions.playDuration),
      ),
    );

  const totalWatchTime = Number(totalWatchTimeResult[0]?.total) || 0;

  // Get total unique items watched (regardless of embeddings)
  const totalItemsResult = await db
    .select({
      count: sql<number>`COUNT(DISTINCT ${sessions.itemId})`,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.userId, userId),
        isNotNull(sessions.itemId),
      ),
    );

  const totalItemCount = Number(totalItemsResult[0]?.count) || 0;

  // Get items WITH embeddings for fingerprint generation
  const watchedItems = await db
    .select({
      id: items.id,
      name: items.name,
      type: items.type,
      genres: items.genres,
      embedding: items.embedding,
      watchTime: sum(sessions.playDuration).as("watchTime"),
    })
    .from(sessions)
    .innerJoin(items, eq(sessions.itemId, items.id))
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.userId, userId),
        isNotNull(items.embedding),
        isNotNull(sessions.playDuration),
      ),
    )
    .groupBy(items.id)
    .orderBy(desc(sum(sessions.playDuration)))
    .limit(100);

  if (watchedItems.length === 0) {
    return {
      userId,
      userName,
      embedding: null,
      genreWeights: {},
      topItems: [],
      totalWatchTime,
      itemCount: totalItemCount,
      visualSeed: 0,
      dominantHue: 200,
      secondaryHue: 280,
      complexity: 0.5,
    };
  }

  // Calculate genre weights from items with embeddings
  const genreWatchTime: Record<string, number> = {};
  let embeddedWatchTime = 0;

  for (const item of watchedItems) {
    const watchTime = Number(item.watchTime) || 0;
    embeddedWatchTime += watchTime;

    if (item.genres) {
      for (const genre of item.genres) {
        genreWatchTime[genre] = (genreWatchTime[genre] || 0) + watchTime;
      }
    }
  }

  // Convert to percentage of total watch time (from embedded items)
  // Note: genres overlap, so percentages won't add to 100%
  const genreWeights: Record<string, number> = {};
  for (const genre of Object.keys(genreWatchTime)) {
    genreWeights[genre] =
      embeddedWatchTime > 0 ? genreWatchTime[genre] / embeddedWatchTime : 0;
  }

  const embeddingsWithWeights = watchedItems
    .filter((item) => item.embedding)
    .map((item) => ({
      embedding: item.embedding as number[],
      weight: Number(item.watchTime) || 1,
    }));

  let avgEmbedding: number[] | null = null;
  let complexity = 0.5;

  if (embeddingsWithWeights.length > 0) {
    const totalWeight = embeddingsWithWeights.reduce((s, e) => s + e.weight, 0);
    const dimensions = embeddingsWithWeights[0].embedding.length;
    avgEmbedding = new Array(dimensions).fill(0);

    for (const { embedding, weight } of embeddingsWithWeights) {
      for (let i = 0; i < dimensions; i++) {
        avgEmbedding[i] += (embedding[i] * weight) / totalWeight;
      }
    }

    // Compute complexity from individual item embeddings vs centroid
    const allEmbeddings = embeddingsWithWeights.map((e) => e.embedding);
    complexity = computeComplexity(allEmbeddings, avgEmbedding);
  }

  const visualProps = computeVisualProperties(avgEmbedding || []);

  return {
    userId,
    userName,
    embedding: avgEmbedding,
    genreWeights,
    topItems: watchedItems.slice(0, 20).map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      embedding: item.embedding,
      watchTime: Number(item.watchTime) || 0,
    })),
    totalWatchTime, // From all sessions, not just embedded items
    itemCount: totalItemCount, // From all sessions, not just embedded items
    complexity,
    ...visualProps,
  };
}
