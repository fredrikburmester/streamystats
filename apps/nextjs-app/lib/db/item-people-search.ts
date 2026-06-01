import { db, itemPeople, items, people } from "@streamystats/database";
import type { Item } from "@streamystats/database/schema";
import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";

export interface ItemPeopleSearchCredit {
  personId: string;
  personName: string;
  creditType: string;
  characterName: string | null;
}

interface ItemPeopleSearchRow extends ItemPeopleSearchCredit {
  item: Item;
}

export interface ItemPeopleSearchResult {
  item: Item;
  credits: ItemPeopleSearchCredit[];
}

export function collapseItemPeopleMatches(
  rows: ItemPeopleSearchRow[],
  limit: number,
): ItemPeopleSearchResult[] {
  const resultsByItemId = new Map<string, ItemPeopleSearchResult>();

  for (const row of rows) {
    const credit = {
      personId: row.personId,
      personName: row.personName,
      creditType: row.creditType,
      characterName: row.characterName,
    };
    const existing = resultsByItemId.get(row.item.id);

    if (existing) {
      existing.credits.push(credit);
    } else {
      resultsByItemId.set(row.item.id, {
        item: row.item,
        credits: [credit],
      });
    }
  }

  return [...resultsByItemId.values()].slice(0, limit);
}

type SearchItemType = "Movie" | "Series" | "all";

function getExpandedRowLimit(limit: number): number {
  return limit * 4;
}

export async function findItemsByPerson({
  serverId,
  personName,
  creditType,
  type,
  limit,
}: {
  serverId: number;
  personName: string;
  creditType: "Actor" | "Director" | "Writer" | "Producer" | "all";
  type: SearchItemType;
  limit: number;
}): Promise<ItemPeopleSearchResult[]> {
  const conditions = [
    eq(itemPeople.serverId, serverId),
    eq(people.serverId, serverId),
    eq(items.serverId, serverId),
    ilike(people.name, `%${personName}%`),
    isNull(items.deletedAt),
  ];

  if (creditType !== "all") {
    conditions.push(eq(itemPeople.type, creditType));
  }
  if (type !== "all") {
    conditions.push(eq(items.type, type));
  } else {
    conditions.push(inArray(items.type, ["Movie", "Series"]));
  }

  const rows = await db
    .select({
      item: items,
      personId: people.id,
      personName: people.name,
      creditType: itemPeople.type,
      characterName: itemPeople.role,
    })
    .from(itemPeople)
    .innerJoin(
      people,
      and(
        eq(itemPeople.personId, people.id),
        eq(itemPeople.serverId, people.serverId),
      ),
    )
    .innerJoin(items, eq(itemPeople.itemId, items.id))
    .where(and(...conditions))
    .orderBy(desc(items.communityRating), items.name, itemPeople.sortOrder)
    .limit(getExpandedRowLimit(limit));

  return collapseItemPeopleMatches(rows, limit);
}

export async function findItemsByCharacter({
  serverId,
  characterName,
  type,
  limit,
}: {
  serverId: number;
  characterName: string;
  type: SearchItemType;
  limit: number;
}): Promise<ItemPeopleSearchResult[]> {
  const conditions = [
    eq(itemPeople.serverId, serverId),
    eq(itemPeople.type, "Actor"),
    eq(items.serverId, serverId),
    ilike(itemPeople.role, `%${characterName}%`),
    isNull(items.deletedAt),
  ];

  if (type !== "all") {
    conditions.push(eq(items.type, type));
  } else {
    conditions.push(inArray(items.type, ["Movie", "Series"]));
  }

  const rows = await db
    .select({
      item: items,
      personId: people.id,
      personName: people.name,
      creditType: itemPeople.type,
      characterName: itemPeople.role,
    })
    .from(itemPeople)
    .innerJoin(
      people,
      and(
        eq(itemPeople.personId, people.id),
        eq(itemPeople.serverId, people.serverId),
      ),
    )
    .innerJoin(items, eq(itemPeople.itemId, items.id))
    .where(and(...conditions))
    .orderBy(desc(items.communityRating), items.name, itemPeople.sortOrder)
    .limit(getExpandedRowLimit(limit));

  return collapseItemPeopleMatches(rows, limit);
}
