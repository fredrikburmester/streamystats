"use server";

import "server-only";

import { db, sessions } from "@streamystats/database";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { jobServer } from "@/lib/job-server";
import { getSession } from "@/lib/session";

/**
 * Get count of inferred sessions for a server/user
 */
export async function getInferredSessionCount(
  serverId: number,
  userId?: string,
): Promise<number> {
  const conditions = [
    eq(sessions.serverId, serverId),
    eq(sessions.isInferred, true),
  ];

  if (userId) {
    conditions.push(eq(sessions.userId, userId));
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(and(...conditions));

  return Number(result[0]?.count ?? 0);
}

/**
 * Trigger watchtime inference for the current user or a specific user
 * Non-admins can only trigger for themselves
 */
export async function triggerInferWatchtime(
  serverId: number,
  userId?: string,
): Promise<{ success: boolean; message: string; jobId?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: "Not authenticated" };
    }

    // Determine target user
    const targetUserId = userId || session.id;

    // Security check: non-admins can only trigger for themselves
    if (!session.isAdmin && targetUserId !== session.id) {
      return {
        success: false,
        message: "You can only infer watchtime for yourself",
      };
    }

    const data = await jobServer.triggerInferWatchtime({
      serverId,
      userId: targetUserId,
      triggeredBy: session.id,
      isAdmin: session.isAdmin,
    });

    // Revalidate user page to show updated stats
    revalidatePath(`/servers/${serverId}/users/${targetUserId}`);

    return {
      success: true,
      message: data.message || "Watchtime inference job started",
      jobId: data.jobId,
    };
  } catch (error) {
    console.error("Error triggering watchtime inference:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to trigger inference",
    };
  }
}

/**
 * Trigger watchtime inference for all users (admin only)
 */
export async function triggerInferWatchtimeForAll(
  serverId: number,
): Promise<{ success: boolean; message: string; jobId?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: "Not authenticated" };
    }

    if (!session.isAdmin) {
      return {
        success: false,
        message: "Admin access required to infer for all users",
      };
    }

    const data = await jobServer.triggerInferWatchtime({
      serverId,
      userId: undefined, // All users
      triggeredBy: session.id,
      isAdmin: true,
    });

    // Revalidate users page
    revalidatePath(`/servers/${serverId}/users`);

    return {
      success: true,
      message: data.message || "Watchtime inference job started for all users",
      jobId: data.jobId,
    };
  } catch (error) {
    console.error("Error triggering watchtime inference for all:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to trigger inference",
    };
  }
}

/**
 * Delete inferred sessions for a user or all users on a server
 * Users can only delete their own inferred sessions
 * Admins can delete for any user or all users
 */
export async function cleanupInferredSessions(
  serverId: number,
  userId?: string,
): Promise<{ success: boolean; message: string; deletedCount?: number }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, message: "Not authenticated" };
    }

    // Security check
    if (!session.isAdmin) {
      // Non-admins can only cleanup their own sessions
      if (!userId || userId !== session.id) {
        return {
          success: false,
          message: "You can only remove your own inferred sessions",
        };
      }
    }

    const data = await jobServer.cleanupInferredSessions({ serverId, userId });

    // Revalidate relevant pages
    if (userId) {
      revalidatePath(`/servers/${serverId}/users/${userId}`);
    } else {
      revalidatePath(`/servers/${serverId}/users`);
    }

    return {
      success: true,
      message: data.message || `Deleted ${data.deletedCount} inferred sessions`,
      deletedCount: data.deletedCount,
    };
  } catch (error) {
    console.error("Error cleaning up inferred sessions:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to cleanup sessions",
    };
  }
}
