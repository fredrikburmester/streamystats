import { ItemStatistics } from "@/app/(app)/servers/[id]/(auth)/library/[libraryId]/[itemSlug]/ItemDetailsTable";

export async function getItemDetails(serverId: string, itemId: string): Promise<ItemStatistics> {
  const response = await fetch(`/api/servers/${serverId}/statistics/items/${itemId}`, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch item details");
  }

  return response.json();
} 