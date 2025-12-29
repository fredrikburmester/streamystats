import { db, items, sessions, type User } from "@streamystats/database";
import { and, desc, eq, gte, inArray, isNotNull, lte, sum } from "drizzle-orm";

import { getExclusionSettings } from "./exclusions";
import { getUsers } from "./users";

// Helper for cosine similarity in memory
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magnitudeA += vecA[i] * vecA[i];
    magnitudeB += vecB[i] * vecB[i];
  }
  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}

// Calculate average embedding from a list of embeddings
function averageEmbeddings(embeddings: number[][]): number[] | null {
  if (embeddings.length === 0) return null;
  const dimensions = embeddings[0].length;
  const sumVec = new Array(dimensions).fill(0);

  for (const emb of embeddings) {
    if (emb.length !== dimensions) continue;
    for (let i = 0; i < dimensions; i++) {
      sumVec[i] += emb[i];
    }
  }

  return sumVec.map((val) => val / embeddings.length);
}

interface ItemInfo {
  id: string;
  name: string;
  type: string;
  embedding: number[] | null;
  genres: string[] | null;
}

interface UserTopItemsResult {
  embedding: number[] | null;
  items: ItemInfo[];
}

async function getUserTopItemsWithEmbeddings(
  serverId: number,
  userId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<UserTopItemsResult> {

  const whereConditions = [
    eq(sessions.serverId, serverId),
    eq(sessions.userId, userId),
    isNotNull(sessions.playDuration),
  ];

  if (startDate) {
    whereConditions.push(gte(sessions.startTime, startDate));
  }
  if (endDate) {
    whereConditions.push(lte(sessions.startTime, endDate));
  }

  // Helper to get top items of a specific type
  const getTopItemsByType = async (
    type: "Movie" | "Series",
  ): Promise<ItemInfo[]> => {
    if (type === "Series") {
      const topSeries = await db
        .select({
          id: sessions.seriesId,
          duration: sum(sessions.playDuration),
        })
        .from(sessions)
        .innerJoin(items, eq(sessions.itemId, items.id))
        .where(and(...whereConditions, isNotNull(sessions.seriesId)))
        .groupBy(sessions.seriesId)
        .orderBy(desc(sum(sessions.playDuration)))
        .limit(50);

      if (topSeries.length === 0) return [];

      const seriesIds = topSeries
        .map((s) => s.id)
        .filter((id) => id !== null) as string[];

      const seriesItems = await db
        .select({
          id: items.id,
          name: items.name,
          type: items.type,
          embedding: items.embedding,
          genres: items.genres,
        })
        .from(items)
        .where(and(inArray(items.id, seriesIds), isNotNull(items.embedding)));

      return seriesItems;
    }
    // Movies
    const topMovies = await db
      .select({
        id: sessions.itemId,
        duration: sum(sessions.playDuration),
      })
      .from(sessions)
      .innerJoin(items, eq(sessions.itemId, items.id))
      .where(and(...whereConditions, eq(items.type, "Movie")))
      .groupBy(sessions.itemId)
      .orderBy(desc(sum(sessions.playDuration)))
      .limit(50);

    if (topMovies.length === 0) return [];

    const movieIds = topMovies
      .map((m) => m.id)
      .filter((id) => id !== null) as string[];

    const movieItems = await db
      .select({
        id: items.id,
        name: items.name,
        type: items.type,
        embedding: items.embedding,
        genres: items.genres,
      })
      .from(items)
      .where(and(inArray(items.id, movieIds), isNotNull(items.embedding)));

    return movieItems;
  };

  const [movieItems, seriesItems] = await Promise.all([
    getTopItemsByType("Movie"),
    getTopItemsByType("Series"),
  ]);

  const allItems = [...movieItems, ...seriesItems];
  const allEmbeddings = allItems
    .map((item) => item.embedding)
    .filter((e) => e !== null) as number[][];

  return {
    embedding: averageEmbeddings(allEmbeddings),
    items: allItems,
  };
}

export interface SimilarItemPair {
  itemA: { id: string; name: string };
  itemB: { id: string; name: string };
  score: number;
}

export interface SimilarUser {
  user: User;
  similarity: number;
  commonItems: { id: string; name: string }[];
  similarPairs: SimilarItemPair[];
}

export interface UserSimilarityResult {
  overall: SimilarUser[];
  thisMonth: SimilarUser[];
}

// Find pairs of similar items between two lists
// Returns pairs where itemA comes from itemsA (target user) and itemB comes from itemsB (other user)
const findSimilarItemPairs = (
  itemsA: ItemInfo[],
  itemsB: ItemInfo[],
): SimilarItemPair[] => {
  const pairs: SimilarItemPair[] = [];
  const usedIdsA = new Set<string>();
  const usedIdsB = new Set<string>();

  // Calculate all cross-product similarities
  const allPairs: { itemA: ItemInfo; itemB: ItemInfo; score: number }[] = [];

  for (const itemA of itemsA) {
    if (!itemA.embedding) continue;
    for (const itemB of itemsB) {
      if (!itemB.embedding) continue;
      // Skip exact matches (they are handled by commonItems)
      if (itemA.id === itemB.id) continue;
      // Skip matches with very different names but same content (remakes etc) - though maybe interesting?
      // Let's keep them.

      const score = cosineSimilarity(itemA.embedding, itemB.embedding);
      if (score > 0.3) {
        // Only consider high similarity
        allPairs.push({ itemA, itemB, score });
      }
    }
  }

  // Sort by score desc
  allPairs.sort((a, b) => b.score - a.score);

  // Greedily pick best pairs ensuring unique items
  for (const pair of allPairs) {
    if (usedIdsA.has(pair.itemA.id) || usedIdsB.has(pair.itemB.id)) continue;

    usedIdsA.add(pair.itemA.id);
    usedIdsB.add(pair.itemB.id);

    pairs.push({
      itemA: { id: pair.itemA.id, name: pair.itemA.name },
      itemB: { id: pair.itemB.id, name: pair.itemB.name },
      score: pair.score,
    });

    if (pairs.length >= 3) break; // Limit to 3 pairs
  }

  return pairs;
};

export async function getSimilarUsers(
  serverId: string | number,
  targetUserId: string,
): Promise<UserSimilarityResult> {

  const serverIdNum = Number(serverId);

  // Get exclusion settings
  const { excludedUserIds } = await getExclusionSettings(serverIdNum);

  const allUsers = await getUsers({ serverId: serverIdNum });

  // Filter out the target user and excluded users from the list of candidates
  const otherUsers = allUsers.filter(
    (u) => u.id !== targetUserId && !excludedUserIds.includes(u.id),
  );
  if (otherUsers.length === 0) {
    return { overall: [], thisMonth: [] };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59,
  );

  // 1. Calculate target user embeddings
  const [targetOverall, targetMonth] = await Promise.all([
    getUserTopItemsWithEmbeddings(serverIdNum, targetUserId),
    getUserTopItemsWithEmbeddings(
      serverIdNum,
      targetUserId,
      startOfMonth,
      endOfMonth,
    ),
  ]);

  // 2. Calculate other users embeddings (for both timeframes)
  const userEmbeddings = await Promise.all(
    otherUsers.map(async (user) => {
      const [overall, month] = await Promise.all([
        getUserTopItemsWithEmbeddings(serverIdNum, user.id),
        getUserTopItemsWithEmbeddings(
          serverIdNum,
          user.id,
          startOfMonth,
          endOfMonth,
        ),
      ]);
      return {
        user,
        overall,
        month,
      };
    }),
  );

  // 3. Compute similarities
  const overallMatches: SimilarUser[] = [];
  const monthMatches: SimilarUser[] = [];

  for (const entry of userEmbeddings) {
    if (targetOverall.embedding && entry.overall.embedding) {
      const sim = cosineSimilarity(
        targetOverall.embedding,
        entry.overall.embedding,
      );

      // Find common items
      const commonItems = targetOverall.items
        .filter((tItem) =>
          entry.overall.items.some((uItem) => uItem.id === tItem.id),
        )
        .map(({ id, name }) => ({ id, name }));

      // Find similar pairs
      const similarPairs = findSimilarItemPairs(
        targetOverall.items,
        entry.overall.items,
      );

      overallMatches.push({
        user: entry.user,
        similarity: sim,
        commonItems,
        similarPairs,
      });
    }

    if (targetMonth.embedding && entry.month.embedding) {
      const sim = cosineSimilarity(
        targetMonth.embedding,
        entry.month.embedding,
      );

      // Find common items
      const commonItems = targetMonth.items
        .filter((tItem) =>
          entry.month.items.some((uItem) => uItem.id === tItem.id),
        )
        .map(({ id, name }) => ({ id, name }));

      // Find similar pairs
      const similarPairs = findSimilarItemPairs(
        targetMonth.items,
        entry.month.items,
      );

      monthMatches.push({
        user: entry.user,
        similarity: sim,
        commonItems,
        similarPairs,
      });
    }
  }

  // 4. Sort and return top 5
  return {
    overall: overallMatches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5),
    thisMonth: monthMatches
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5),
  };
}
