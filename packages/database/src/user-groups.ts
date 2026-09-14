import { createHash, randomUUID } from "node:crypto";
import {
  and,
  eq,
  getTableName,
  inArray,
  sql,
  type SQL,
  type AnyColumn,
} from "drizzle-orm";
import { db } from "./connection";
import {
  items,
  servers,
  sessions,
  userGroupAudit,
  userGroupMembers,
  userGroups,
  users,
  type UserGroupSnapshot,
} from "./schema";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Database | Transaction;

export class UserGroupError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export type UserGroupChange = {
  groupId: string | null;
  primaryUserId: string;
  memberUserIds: string[];
  expectedRevision: number | null;
};

export type UserGroupAccount = {
  id: string;
  name: string;
  lastActivityDate: Date | null;
  excluded: boolean;
  groupId: string | null;
};

export type UserGroupPreview = {
  change: UserGroupChange;
  before: UserGroupSnapshot | null;
  members: UserGroupAccount[];
  sessionCount: number;
  watchTime: number;
  token: string;
};

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function getUserGroups({
  serverId,
  database = db,
}: {
  serverId: number;
  database?: Reader;
}): Promise<UserGroupSnapshot[]> {
  // One statement keeps membership and revision in the same database snapshot.
  return database
    .select({
      id: userGroups.id,
      serverId: userGroups.serverId,
      primaryUserId: userGroups.primaryUserId,
      revision: userGroups.revision,
      memberUserIds: sql<
        string[]
      >`array_agg(${userGroupMembers.userId} ORDER BY ${userGroupMembers.userId})`,
    })
    .from(userGroups)
    .innerJoin(
      userGroupMembers,
      and(
        eq(userGroupMembers.serverId, userGroups.serverId),
        eq(userGroupMembers.groupId, userGroups.id),
      ),
    )
    .where(eq(userGroups.serverId, serverId))
    .groupBy(userGroups.id);
}

export async function getUserGroupAccounts({
  serverId,
  database = db,
}: {
  serverId: number;
  database?: Reader;
}): Promise<UserGroupAccount[]> {
  const [accounts, server] = await Promise.all([
    database
      .select({
        id: users.id,
        name: users.name,
        lastActivityDate: users.lastActivityDate,
        groupId: userGroupMembers.groupId,
      })
      .from(users)
      .leftJoin(
        userGroupMembers,
        and(
          eq(userGroupMembers.serverId, users.serverId),
          eq(userGroupMembers.userId, users.id),
        ),
      )
      .where(eq(users.serverId, serverId))
      .orderBy(users.name, users.id),
    database
      .select({ excluded: servers.excludedUserIds })
      .from(servers)
      .where(eq(servers.id, serverId)),
  ]);
  return accounts.map((a) => ({
    ...a,
    excluded: server[0]?.excluded?.includes(a.id) ?? false,
  }));
}

export async function resolveAnalyticsUser({
  serverId,
  userId,
  database = db,
}: {
  serverId: number;
  userId: string;
  database?: Reader;
}) {
  const group = (await getUserGroups({ serverId, database })).find((g) =>
    g.memberUserIds.includes(userId),
  );
  return {
    primaryUserId: group?.primaryUserId ?? userId,
    memberUserIds: group?.memberUserIds ?? [userId],
    group: group ?? null,
  };
}

// A subquery expands only the requested person's IDs; stored identities remain
// available for exclusions, ownership checks, and source attribution.
export function analyticsUserScope(
  userId: string | number,
  options: { viewerUserId?: string; serverId?: number | string } = {},
): SQL {
  return sql`(${sessions.userId} IN (
    SELECT ${String(userId)}::text
    UNION SELECT peer.user_id FROM user_group_members member
      JOIN user_group_members peer ON peer.server_id = member.server_id AND peer.group_id = member.group_id
      WHERE member.user_id = ${String(userId)} AND member.server_id = ${options.serverId === undefined ? sessions.serverId : Number(options.serverId)}
  ) AND ${analyticsSessionVisibility(options)})`;
}

// Correlated item lookup also works for history aggregates without an items
// join. Source-account exclusions always apply before identity grouping.
export function analyticsSessionVisibility({
  viewerUserId,
}: {
  viewerUserId?: string;
} = {}): SQL {
  return sql`EXISTS (SELECT 1 FROM servers visibility_server WHERE visibility_server.id = ${sessions.serverId}
    AND NOT COALESCE(${sessions.userId} = ANY(visibility_server.excluded_user_ids), false)
    AND NOT EXISTS (SELECT 1 FROM items visibility_item WHERE visibility_item.id = ${sessions.itemId}
      AND visibility_item.library_id = ANY(visibility_server.excluded_library_ids)))
    ${
      viewerUserId
        ? sql`AND EXISTS (SELECT 1 FROM users viewer WHERE viewer.id = ${viewerUserId} AND viewer.server_id = ${sessions.serverId}
      AND (viewer.is_administrator OR viewer.enable_all_folders OR EXISTS (SELECT 1 FROM items allowed_item
        WHERE allowed_item.id = ${sessions.itemId} AND allowed_item.library_id = ANY(viewer.enabled_folders))))`
        : sql``
    }`;
}

export function analyticsUserId({
  userId = sessions.userId,
  serverId = sessions.serverId,
}: {
  userId?: AnyColumn;
  serverId?: AnyColumn;
} = {}): SQL<string> {
  // Drizzle strips Column qualifiers inside single-table SELECT expressions.
  // Identifiers preserve the outer reference inside this correlated subquery.
  const qualified = (column: AnyColumn) =>
    sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
  return sql<string>`COALESCE((SELECT g.primary_user_id FROM user_group_members m
    JOIN user_groups g ON g.server_id = m.server_id AND g.id = m.group_id
    WHERE m.server_id = ${qualified(serverId)} AND m.user_id = ${qualified(userId)}), ${qualified(userId)})`;
}

export async function previewUserGroup({
  serverId,
  change,
  database = db,
}: {
  serverId: number;
  change: UserGroupChange;
  database?: Reader;
}): Promise<UserGroupPreview> {
  const memberUserIds = [...new Set(change.memberUserIds)].sort();
  if (
    memberUserIds.length !== change.memberUserIds.length ||
    memberUserIds.length < (change.groupId ? 1 : 2) ||
    memberUserIds.length > 100 ||
    !memberUserIds.includes(change.primaryUserId)
  ) {
    throw new UserGroupError(
      "Select distinct accounts and a primary account from the selection.",
    );
  }
  const [groups, accounts] = await Promise.all([
    getUserGroups({ serverId, database }),
    getUserGroupAccounts({ serverId, database }),
  ]);
  const before = groups.find((g) => g.id === change.groupId) ?? null;
  if (
    (change.groupId && !before) ||
    (before?.revision ?? null) !== change.expectedRevision
  ) {
    throw new UserGroupError(
      "Accounts changed. Refresh the preview and try again.",
      409,
    );
  }
  const members = memberUserIds.map((id) => {
    const account = accounts.find((a) => a.id === id);
    if (!account)
      throw new UserGroupError("All accounts must belong to this server.");
    if (account.groupId && account.groupId !== change.groupId)
      throw new UserGroupError(
        "Unlink accounts from their existing group first.",
        409,
      );
    return account;
  });
  const normalized = { ...change, memberUserIds };
  const [server] = await database
    .select({ excludedLibraries: servers.excludedLibraryIds })
    .from(servers)
    .where(eq(servers.id, serverId));
  const visibleIds = members.filter((m) => !m.excluded).map((m) => m.id);
  const [totals] = visibleIds.length
    ? await database
        .select({
          sessionCount: sql<number>`count(*)::int`,
          watchTime: sql<number>`coalesce(sum(${sessions.playDuration}), 0)::float8`,
        })
        .from(sessions)
        .leftJoin(items, eq(items.id, sessions.itemId))
        .where(
          and(
            eq(sessions.serverId, serverId),
            inArray(sessions.userId, visibleIds),
            server?.excludedLibraries?.length
              ? sql`(${items.libraryId} IS NULL OR ${items.libraryId} NOT IN (${sql.join(
                  server.excludedLibraries.map((id) => sql`${id}`),
                  sql`, `,
                )}))`
              : undefined,
          ),
        )
    : [];
  return {
    change: normalized,
    before,
    members,
    sessionCount: totals?.sessionCount ?? 0,
    watchTime: totals?.watchTime ?? 0,
    token: hash({
      serverId,
      change: normalized,
      before,
      members: members.map((m) => ({
        id: m.id,
        groupId: m.groupId,
        excluded: m.excluded,
      })),
      excludedLibraries: server?.excludedLibraries,
    }),
  };
}

export async function changeUserGroup({
  serverId,
  change,
  previewToken,
  operationId,
  actor,
  database = db,
}: {
  serverId: number;
  change: UserGroupChange;
  previewToken: string;
  operationId: string;
  actor: { id: string; name: string };
  database?: Database;
}): Promise<UserGroupSnapshot | null> {
  const requestHash = hash({
    change: { ...change, memberUserIds: [...change.memberUserIds].sort() },
    previewToken,
  });
  return database.transaction(async (tx) => {
    // Serialize membership mutations per server, including group dissolution and
    // replay. Sync only updates accounts, so it cannot overwrite these records.
    const locked = await tx
      .select({ id: servers.id })
      .from(servers)
      .where(eq(servers.id, serverId))
      .for("update");
    if (!locked.length) throw new UserGroupError("Server not found.", 404);
    const [prior] = await tx
      .select()
      .from(userGroupAudit)
      .where(
        and(
          eq(userGroupAudit.serverId, serverId),
          eq(userGroupAudit.operationId, operationId),
        ),
      );
    if (prior) {
      if (prior.requestHash !== requestHash || prior.actorId !== actor.id)
        throw new UserGroupError(
          "Operation ID already used for a different request.",
          409,
        );
      return prior.after;
    }
    const preview = await previewUserGroup({ serverId, change, database: tx });
    if (preview.token !== previewToken)
      throw new UserGroupError(
        "Preview expired. Review the accounts again.",
        409,
      );
    const id = change.groupId ?? randomUUID();
    const after: UserGroupSnapshot | null =
      preview.members.length > 1
        ? {
            id,
            serverId,
            primaryUserId: change.primaryUserId,
            memberUserIds: preview.change.memberUserIds,
            revision: (preview.before?.revision ?? 0) + 1,
          }
        : null;
    if (after) {
      if (preview.before) {
        await tx
          .update(userGroups)
          .set({
            primaryUserId: after.primaryUserId,
            revision: after.revision,
            updatedAt: new Date(),
          })
          .where(and(eq(userGroups.id, id), eq(userGroups.serverId, serverId)));
        await tx
          .delete(userGroupMembers)
          .where(
            and(
              eq(userGroupMembers.serverId, serverId),
              eq(userGroupMembers.groupId, id),
            ),
          );
      } else {
        await tx
          .insert(userGroups)
          .values({ id, serverId, primaryUserId: after.primaryUserId });
      }
      await tx
        .insert(userGroupMembers)
        .values(
          after.memberUserIds.map((userId) => ({
            serverId,
            groupId: id,
            userId,
          })),
        );
    } else {
      await tx
        .delete(userGroups)
        .where(and(eq(userGroups.id, id), eq(userGroups.serverId, serverId)));
    }
    await tx
      .insert(userGroupAudit)
      .values({
        serverId,
        operationId,
        actorId: actor.id,
        actorName: actor.name,
        requestHash,
        before: preview.before,
        after,
      });
    return after;
  });
}
