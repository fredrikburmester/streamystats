"use server";

import { db } from "@streamystats/database";
import { servers } from "@streamystats/database/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod/v4";
import { isUserAdmin } from "@/lib/db/users";

const exclusionSchema = z.object({
  serverId: z.number().int().positive(),
  ids: z.array(z.string().max(200)).max(1000),
});

export async function updateExcludedUsersAction(
  serverId: number,
  excludedUserIds: string[],
) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return { success: false, message: "Admin privileges required" };
    }

    const parsed = exclusionSchema.safeParse({
      serverId,
      ids: excludedUserIds,
    });
    if (!parsed.success) {
      return { success: false, message: "Invalid input" };
    }

    await db
      .update(servers)
      .set({ excludedUserIds: parsed.data.ids })
      .where(eq(servers.id, parsed.data.serverId));

    revalidatePath(`/servers/${parsed.data.serverId}/dashboard`);
    revalidatePath(`/servers/${parsed.data.serverId}/settings/exclusions`);
    revalidatePath(`/servers/${parsed.data.serverId}/library`);
    revalidatePath(`/servers/${parsed.data.serverId}/users`);
    revalidatePath(`/servers/${parsed.data.serverId}/history`);

    return { success: true, message: "Excluded users updated" };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}

export async function updateExcludedLibrariesAction(
  serverId: number,
  excludedLibraryIds: string[],
) {
  try {
    const isAdmin = await isUserAdmin();
    if (!isAdmin) {
      return { success: false, message: "Admin privileges required" };
    }

    const parsed = exclusionSchema.safeParse({
      serverId,
      ids: excludedLibraryIds,
    });
    if (!parsed.success) {
      return { success: false, message: "Invalid input" };
    }

    await db
      .update(servers)
      .set({ excludedLibraryIds: parsed.data.ids })
      .where(eq(servers.id, parsed.data.serverId));

    revalidatePath(`/servers/${parsed.data.serverId}/dashboard`);
    revalidatePath(`/servers/${parsed.data.serverId}/settings/exclusions`);
    revalidatePath(`/servers/${parsed.data.serverId}/library`);
    revalidatePath(`/servers/${parsed.data.serverId}/users`);
    revalidatePath(`/servers/${parsed.data.serverId}/history`);

    return { success: true, message: "Excluded libraries updated" };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to update settings",
    };
  }
}
