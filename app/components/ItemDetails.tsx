"use client";

import { Item } from "@/lib/db";
import { ItemDetailsTable, ItemStatistics } from "@/app/(app)/servers/[id]/(auth)/library/[libraryId]/[itemSlug]/ItemDetailsTable";

interface ItemDetailsProps {
  item: Item;
  statistics: ItemStatistics;
  serverUrl?: string;
}

export function ItemDetails({ item, statistics, serverUrl }: ItemDetailsProps) {
  return (
    <ItemDetailsTable 
      item={item} 
      statistics={statistics} 
      serverUrl={serverUrl}
    />
  );
}
