"use server";

import {
  db,
  servers,
  users,
  items,
  sessions,
  activities,
  libraries,
  jobResults,
} from "@streamystats/database";
import { eq, sql, and, count, desc } from "drizzle-orm";

import { Server } from "@streamystats/database/schema";

export const getServers = async (): Promise<Server[]> => {
  return await db.select().from(servers);
};

export const getServer = async ({
  serverId
}: {
  serverId: number | string;
}): Promise<Server | undefined> => {
  return await db.query.servers.findFirst({
    where: eq(servers.id, Number(serverId)),
  });
};

/**
 * Deletes a server and all its associated data
 * This will cascade delete all related users, libraries, activities, sessions, and items
 * @param serverId - The ID of the server to delete
 * @returns Promise<{ success: boolean; message: string }>
 */
export const deleteServer = async ({
  serverId
}: {
  serverId: number;
}): Promise<{ success: boolean; message: string }> => {
  try {
    // First verify the server exists
    const serverExists = await db
      .select({ id: servers.id, name: servers.name })
      .from(servers)
      .where(eq(servers.id, serverId))
      .limit(1);

    if (!serverExists.length) {
      return {
        success: false,
        message: `Delete: Server with ID ${serverId} not found`,
      };
    }

    const serverName = serverExists[0].name;

    await db.delete(servers).where(eq(servers.id, serverId));

    return {
      success: true,
      message: `Server "${serverName}" and all associated data deleted successfully`,
    };
  } catch (error) {
    console.error(`Error deleting server ${serverId}:`, error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete server",
    };
  }
};





