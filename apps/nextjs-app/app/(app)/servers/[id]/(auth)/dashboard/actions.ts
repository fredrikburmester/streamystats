"use server";

import { getMostWatchedItems } from "@/lib/db/statistics";
import { getMe } from "@/lib/db/users";
import { showAdminStatistics } from "@/utils/adminTools";

export async function getFilteredMostWatchedItems(
  serverId: string,
  startDate?: string,
  endDate?: string
) {
  try {
    const [me, sas] = await Promise.all([
      getMe(),
      showAdminStatistics(),
    ]);

    const data = await getMostWatchedItems({
      serverId,
      userId: sas ? undefined : me?.id,
      startDate,
      endDate,
    });

    return { success: true as const, data };
  } catch (error) {
    console.error("Error fetching filtered most watched items:", error);
    return { success: false as const, error: "Failed to fetch data", data: undefined };
  }
}