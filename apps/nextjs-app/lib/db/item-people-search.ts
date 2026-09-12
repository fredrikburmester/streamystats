import { db, itemPeople, items, people } from "@streamystats/database";
import type { Item } from "@streamystats/database/schema";
import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";

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
  requiredPersonNames: string[],
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

  const normalizedNames = requiredPersonNames.map((name) =>
    name.trim().toLowerCase(),
  );

  return [...resultsByItemId.values()]
    .filter(({ credits }) =>
      normalizedNames.every((name) =>
        credits.some((credit) =>
          credit.personName.toLowerCase().includes(name),
        ),
      ),
    )
    .slice(0, limit);
}

type SearchItemType = "Movie" | "Series" | "all";

function getExpandedRowLimit(limit: number): number {
  return limit * 4;
}

export async function findItemsByPerson({
  serverId,
  personNames,
  creditType,
  type,
  limit,
}: {
  serverId: number;
  personNames: string[];
  creditType: "Actor" | "Director" | "Writer" | "Producer" | "all";
  type: SearchItemType;
  limit: number;
}): Promise<ItemPeopleSearchResult[]> {
  const normalizedNames = personNames
    .map((name) => name.trim())
    .filter((name) => name.length > 0);

  if (normalizedNames.length === 0) {
    return [];
  }

  const conditions = [
    eq(itemPeople.serverId, serverId),
    eq(people.serverId, serverId),
    eq(items.serverId, serverId),
    or(...normalizedNames.map((name) => ilike(people.name, `%${name}%`))),
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
    .orderBy(desc(items.communityRating), items.name, itemPeople.sortOrder);

  return collapseItemPeopleMatches(rows, normalizedNames, limit);
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

  return collapseItemPeopleMatches(rows, [], limit);
}
