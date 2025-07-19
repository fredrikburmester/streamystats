"use server";

import { deleteServer as deleteServerFromDb } from "@/lib/db/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

/**
 * Server action to delete a server
 * @param serverId - The ID of the server to delete
 */
export async function deleteServerAction(serverId: number) {
  try {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const result = await deleteServerFromDb(serverId);

    if (result.success) {
      // Revalidate relevant paths
      revalidatePath(`${basePath}/`);
      revalidatePath(`${basePath}/servers`);

      // Return success result
      return {
        success: true,
        message: result.message,
      };
    } else {
      return {
        success: false,
        message: result.message,
      };
    }
  } catch (error) {
    console.error("Server action - Error deleting server:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to delete server",
    };
  }
}
