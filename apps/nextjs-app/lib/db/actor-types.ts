import "server-only";

import type { Item } from "@streamystats/database";
import { db, itemPeople, people } from "@streamystats/database";
import { and, eq } from "drizzle-orm";

/**
 * Person type from the normalized people table
 */
export interface PersonFromDb {
  id: string;
  name: string;
  type: string;
  role?: string;
  primaryImageTag?: string;
}

export interface ActorStats {
  id: string;
  name: string;
  type: string;
  role?: string;
  primaryImageTag?: string;
  totalItems: number;
  totalViews: number;
  totalWatchTime: number;
}

export interface ActorItem {
  item: Item;
  role?: string;
  totalViews: number;
  totalWatchTime: number;
}

export interface ActorDetailsResponse {
  id: string;
  name: string;
  type: string;
  primaryImageTag?: string;
  totalItems: number;
  totalViews: number;
  totalWatchTime: number;
  items: ActorItem[];
}

/**
 * Get all people for an item from the normalized tables
 * Note: type is stored on item_people, not on people, since a person can have
 * different roles in different items (e.g., Actor in one, Director in another)
 */
export async function getItemPeople(
  itemId: string,
  serverId: number,
): Promise<PersonFromDb[]> {
  const results = await db
    .select({
      id: people.id,
      name: people.name,
      type: itemPeople.type,
      role: itemPeople.role,
      primaryImageTag: people.primaryImageTag,
    })
    .from(itemPeople)
    .innerJoin(
      people,
      and(
        eq(itemPeople.personId, people.id),
        eq(itemPeople.serverId, people.serverId),
      ),
    )
    .where(
      and(eq(itemPeople.itemId, itemId), eq(itemPeople.serverId, serverId)),
    )
    .orderBy(itemPeople.sortOrder);

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    role: r.role ?? undefined,
    primaryImageTag: r.primaryImageTag ?? undefined,
  }));
}

/**
 * Get cast from an item (only actors)
 */
export async function getItemCast(
  itemId: string,
  serverId: number,
): Promise<PersonFromDb[]> {
  const results = await db
    .select({
      id: people.id,
      name: people.name,
      type: itemPeople.type,
      role: itemPeople.role,
      primaryImageTag: people.primaryImageTag,
    })
    .from(itemPeople)
    .innerJoin(
      people,
      and(
        eq(itemPeople.personId, people.id),
        eq(itemPeople.serverId, people.serverId),
      ),
    )
    .where(
      and(
        eq(itemPeople.itemId, itemId),
        eq(itemPeople.serverId, serverId),
        eq(itemPeople.type, "Actor"),
      ),
    )
    .orderBy(itemPeople.sortOrder);

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    role: r.role ?? undefined,
    primaryImageTag: r.primaryImageTag ?? undefined,
  }));
}

/**
 * Get directors from an item
 */
export async function getItemDirectors(
  itemId: string,
  serverId: number,
): Promise<PersonFromDb[]> {
  const results = await db
    .select({
      id: people.id,
      name: people.name,
      type: itemPeople.type,
      role: itemPeople.role,
      primaryImageTag: people.primaryImageTag,
    })
    .from(itemPeople)
    .innerJoin(
      people,
      and(
        eq(itemPeople.personId, people.id),
        eq(itemPeople.serverId, people.serverId),
      ),
    )
    .where(
      and(
        eq(itemPeople.itemId, itemId),
        eq(itemPeople.serverId, serverId),
        eq(itemPeople.type, "Director"),
      ),
    )
    .orderBy(itemPeople.sortOrder);

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    role: r.role ?? undefined,
    primaryImageTag: r.primaryImageTag ?? undefined,
  }));
}

/**
 * Get writers from an item
 */
export async function getItemWriters(
  itemId: string,
  serverId: number,
): Promise<PersonFromDb[]> {
  const results = await db
    .select({
      id: people.id,
      name: people.name,
      type: itemPeople.type,
      role: itemPeople.role,
      primaryImageTag: people.primaryImageTag,
    })
    .from(itemPeople)
    .innerJoin(
      people,
      and(
        eq(itemPeople.personId, people.id),
        eq(itemPeople.serverId, people.serverId),
      ),
    )
    .where(
      and(
        eq(itemPeople.itemId, itemId),
        eq(itemPeople.serverId, serverId),
        eq(itemPeople.type, "Writer"),
      ),
    )
    .orderBy(itemPeople.sortOrder);

  return results.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    role: r.role ?? undefined,
    primaryImageTag: r.primaryImageTag ?? undefined,
  }));
}

/**
 * Get all people from an item grouped by type
 */
export async function getItemPeopleGrouped(
  itemId: string,
  serverId: number,
): Promise<Record<string, PersonFromDb[]>> {
  const allPeople = await getItemPeople(itemId, serverId);
  const grouped: Record<string, PersonFromDb[]> = {};

  for (const person of allPeople) {
    const type = person.type || "Other";
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(person);
  }

  return grouped;
}
