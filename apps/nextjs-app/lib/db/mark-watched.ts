"use server";

import {
  db,
  items,
  type NewSession,
  servers,
  sessions,
  users,
} from "@streamystats/database";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";

export interface MarkWatchedResult {
  success: boolean;
  message: string;
  isPlayed?: boolean;
}

/**
 * Get the user's watchtime inference preference
 * Returns null if not yet set (user hasn't been asked)
 */
export async function getUserInferWatchtimePreference(
  userId: string,
  serverId: number | string,
): Promise<boolean | null> {
  const serverIdNum = Number(serverId);
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.serverId, serverIdNum)),
  });
  return user?.inferWatchtimeOnMarkWatched ?? null;
}

/**
 * Update the user's watchtime inference preference
 */
export async function setUserInferWatchtimePreference(
  userId: string,
  serverId: number | string,
  preference: boolean,
): Promise<{ success: boolean }> {
  const session = await getSession();
  if (!session || session.id !== userId) {
    return { success: false };
  }

  const serverIdNum = Number(serverId);
  await db
    .update(users)
    .set({ inferWatchtimeOnMarkWatched: preference })
    .where(and(eq(users.id, userId), eq(users.serverId, serverIdNum)));

  return { success: true };
}

/**
 * Reset the user's watchtime inference preference to null (ask each time)
 */
export async function resetUserInferWatchtimePreference(
  userId: string,
  serverId: number | string,
): Promise<{ success: boolean }> {
  const session = await getSession();
  if (!session || session.id !== userId) {
    return { success: false };
  }

  const serverIdNum = Number(serverId);
  await db
    .update(users)
    .set({ inferWatchtimeOnMarkWatched: null })
    .where(and(eq(users.id, userId), eq(users.serverId, serverIdNum)));

  return { success: true };
}

/**
 * Mark an item as watched or unwatched via Jellyfin API
 */
export async function markItemWatched(
  serverId: number | string,
  itemId: string,
  watched: boolean,
  inferWatchtime?: boolean,
): Promise<MarkWatchedResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, message: "Not authenticated" };
  }

  const serverIdNum = Number(serverId);
  if (session.serverId !== serverIdNum) {
    return { success: false, message: "Server mismatch" };
  }

  const server = await db.query.servers.findFirst({
    where: eq(servers.id, serverIdNum),
  });

  if (!server) {
    return { success: false, message: "Server not found" };
  }

  const c = await cookies();
  const token = c.get("streamystats-token")?.value;

  if (!token) {
    return { success: false, message: "No authentication token" };
  }

  try {
    const method = watched ? "POST" : "DELETE";
    const response = await fetch(
      `${server.url}/Users/${session.id}/PlayedItems/${itemId}`,
      {
        method,
        headers: {
          "Authorization": `MediaBrowser Client="Streamystats", Token="${token}"`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      return {
        success: false,
        message: `Jellyfin returned ${response.status}`,
      };
    }

    // If marking as watched and user wants watchtime inference, create inferred session
    if (watched && inferWatchtime) {
      await createInferredSessionForItem(
        serverIdNum,
        session.id,
        session.name,
        itemId,
      );
    }

    revalidatePath(`/servers/${serverIdNum}/library/${itemId}`);

    return {
      success: true,
      message: watched ? "Marked as watched" : "Marked as unwatched",
      isPlayed: watched,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update",
    };
  }
}

/**
 * Delete inferred sessions for an item when marked as unwatched
 */
export async function deleteInferredSessionForItem(
  serverId: number | string,
  userId: string,
  itemId: string,
): Promise<number> {
  const serverIdNum = Number(serverId);
  const result = await db
    .delete(sessions)
    .where(
      and(
        eq(sessions.serverId, serverIdNum),
        eq(sessions.userId, userId),
        eq(sessions.itemId, itemId),
        eq(sessions.isInferred, true),
      ),
    )
    .returning({ id: sessions.id });

  return result.length;
}

/**
 * Create an inferred session for an item when marked as watched
 */
async function createInferredSessionForItem(
  serverId: number,
  userId: string,
  userName: string,
  itemId: string,
): Promise<void> {
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });

  if (!item || !item.runtimeTicks) return;

  const now = new Date();
  const sessionId = `inferred:mark-watched:${serverId}:${userId}:${itemId}:${now.toISOString()}`;

  const playDurationSeconds = Math.floor(
    Number(item.runtimeTicks) / 10_000_000,
  );

  const newSession: NewSession = {
    id: sessionId,
    serverId,
    userId,
    itemId,
    userName,
    userServerId: userId,
    itemName: item.name,
    seriesId: item.seriesId ?? null,
    seriesName: item.seriesName ?? null,
    seasonId: item.seasonId ?? null,
    playDuration: playDurationSeconds,
    startTime: now,
    endTime: now,
    runtimeTicks: item.runtimeTicks,
    positionTicks: item.runtimeTicks,
    percentComplete: 100,
    completed: true,
    isPaused: false,
    isMuted: false,
    isActive: false,
    isInferred: true,
    isTranscoded: false,
    rawData: {
      source: "mark-as-watched",
      inferredAt: now.toISOString(),
    },
  };

  await db.insert(sessions).values(newSession).onConflictDoNothing();
}
