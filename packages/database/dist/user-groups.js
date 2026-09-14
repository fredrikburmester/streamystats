"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserGroupError = void 0;
exports.getUserGroups = getUserGroups;
exports.getUserGroupAccounts = getUserGroupAccounts;
exports.resolveAnalyticsUser = resolveAnalyticsUser;
exports.analyticsUserScope = analyticsUserScope;
exports.analyticsSessionVisibility = analyticsSessionVisibility;
exports.analyticsUserId = analyticsUserId;
exports.previewUserGroup = previewUserGroup;
exports.changeUserGroup = changeUserGroup;
const node_crypto_1 = require("node:crypto");
const drizzle_orm_1 = require("drizzle-orm");
const connection_1 = require("./connection");
const schema_1 = require("./schema");
class UserGroupError extends Error {
    status;
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
exports.UserGroupError = UserGroupError;
const hash = (value) => (0, node_crypto_1.createHash)("sha256").update(JSON.stringify(value)).digest("hex");
async function getUserGroups({ serverId, database = connection_1.db, }) {
    // One statement keeps membership and revision in the same database snapshot.
    return database
        .select({
        id: schema_1.userGroups.id,
        serverId: schema_1.userGroups.serverId,
        primaryUserId: schema_1.userGroups.primaryUserId,
        revision: schema_1.userGroups.revision,
        memberUserIds: (0, drizzle_orm_1.sql) `array_agg(${schema_1.userGroupMembers.userId} ORDER BY ${schema_1.userGroupMembers.userId})`,
    })
        .from(schema_1.userGroups)
        .innerJoin(schema_1.userGroupMembers, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userGroupMembers.serverId, schema_1.userGroups.serverId), (0, drizzle_orm_1.eq)(schema_1.userGroupMembers.groupId, schema_1.userGroups.id)))
        .where((0, drizzle_orm_1.eq)(schema_1.userGroups.serverId, serverId))
        .groupBy(schema_1.userGroups.id);
}
async function getUserGroupAccounts({ serverId, database = connection_1.db, }) {
    const [accounts, server] = await Promise.all([
        database
            .select({
            id: schema_1.users.id,
            name: schema_1.users.name,
            lastActivityDate: schema_1.users.lastActivityDate,
            groupId: schema_1.userGroupMembers.groupId,
        })
            .from(schema_1.users)
            .leftJoin(schema_1.userGroupMembers, (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userGroupMembers.serverId, schema_1.users.serverId), (0, drizzle_orm_1.eq)(schema_1.userGroupMembers.userId, schema_1.users.id)))
            .where((0, drizzle_orm_1.eq)(schema_1.users.serverId, serverId))
            .orderBy(schema_1.users.name, schema_1.users.id),
        database
            .select({ excluded: schema_1.servers.excludedUserIds })
            .from(schema_1.servers)
            .where((0, drizzle_orm_1.eq)(schema_1.servers.id, serverId)),
    ]);
    return accounts.map((a) => ({
        ...a,
        excluded: server[0]?.excluded?.includes(a.id) ?? false,
    }));
}
async function resolveAnalyticsUser({ serverId, userId, database = connection_1.db, }) {
    const group = (await getUserGroups({ serverId, database })).find((g) => g.memberUserIds.includes(userId));
    return {
        primaryUserId: group?.primaryUserId ?? userId,
        memberUserIds: group?.memberUserIds ?? [userId],
        group: group ?? null,
    };
}
// A subquery expands only the requested person's IDs; stored identities remain
// available for exclusions, ownership checks, and source attribution.
function analyticsUserScope(userId, options = {}) {
    return (0, drizzle_orm_1.sql) `(${schema_1.sessions.userId} IN (
    SELECT ${String(userId)}::text
    UNION SELECT peer.user_id FROM user_group_members member
      JOIN user_group_members peer ON peer.server_id = member.server_id AND peer.group_id = member.group_id
      WHERE member.user_id = ${String(userId)} AND member.server_id = ${options.serverId === undefined ? schema_1.sessions.serverId : Number(options.serverId)}
  ) AND ${analyticsSessionVisibility(options)})`;
}
// Correlated item lookup also works for history aggregates without an items
// join. Source-account exclusions always apply before identity grouping.
function analyticsSessionVisibility({ viewerUserId, } = {}) {
    return (0, drizzle_orm_1.sql) `EXISTS (SELECT 1 FROM servers visibility_server WHERE visibility_server.id = ${schema_1.sessions.serverId}
    AND NOT COALESCE(${schema_1.sessions.userId} = ANY(visibility_server.excluded_user_ids), false)
    AND NOT EXISTS (SELECT 1 FROM items visibility_item WHERE visibility_item.id = ${schema_1.sessions.itemId}
      AND visibility_item.library_id = ANY(visibility_server.excluded_library_ids)))
    ${viewerUserId
        ? (0, drizzle_orm_1.sql) `AND EXISTS (SELECT 1 FROM users viewer WHERE viewer.id = ${viewerUserId} AND viewer.server_id = ${schema_1.sessions.serverId}
      AND (viewer.is_administrator OR viewer.enable_all_folders OR EXISTS (SELECT 1 FROM items allowed_item
        WHERE allowed_item.id = ${schema_1.sessions.itemId} AND allowed_item.library_id = ANY(viewer.enabled_folders))))`
        : (0, drizzle_orm_1.sql) ``}`;
}
function analyticsUserId({ userId = schema_1.sessions.userId, serverId = schema_1.sessions.serverId, } = {}) {
    // Drizzle strips Column qualifiers inside single-table SELECT expressions.
    // Identifiers preserve the outer reference inside this correlated subquery.
    const qualified = (column) => (0, drizzle_orm_1.sql) `${drizzle_orm_1.sql.identifier((0, drizzle_orm_1.getTableName)(column.table))}.${drizzle_orm_1.sql.identifier(column.name)}`;
    return (0, drizzle_orm_1.sql) `COALESCE((SELECT g.primary_user_id FROM user_group_members m
    JOIN user_groups g ON g.server_id = m.server_id AND g.id = m.group_id
    WHERE m.server_id = ${qualified(serverId)} AND m.user_id = ${qualified(userId)}), ${qualified(userId)})`;
}
async function previewUserGroup({ serverId, change, database = connection_1.db, }) {
    const memberUserIds = [...new Set(change.memberUserIds)].sort();
    if (memberUserIds.length !== change.memberUserIds.length ||
        memberUserIds.length < (change.groupId ? 1 : 2) ||
        memberUserIds.length > 100 ||
        !memberUserIds.includes(change.primaryUserId)) {
        throw new UserGroupError("Select distinct accounts and a primary account from the selection.");
    }
    const [groups, accounts] = await Promise.all([
        getUserGroups({ serverId, database }),
        getUserGroupAccounts({ serverId, database }),
    ]);
    const before = groups.find((g) => g.id === change.groupId) ?? null;
    if ((change.groupId && !before) ||
        (before?.revision ?? null) !== change.expectedRevision) {
        throw new UserGroupError("Accounts changed. Refresh the preview and try again.", 409);
    }
    const members = memberUserIds.map((id) => {
        const account = accounts.find((a) => a.id === id);
        if (!account)
            throw new UserGroupError("All accounts must belong to this server.");
        if (account.groupId && account.groupId !== change.groupId)
            throw new UserGroupError("Unlink accounts from their existing group first.", 409);
        return account;
    });
    const normalized = { ...change, memberUserIds };
    const [server] = await database
        .select({ excludedLibraries: schema_1.servers.excludedLibraryIds })
        .from(schema_1.servers)
        .where((0, drizzle_orm_1.eq)(schema_1.servers.id, serverId));
    const visibleIds = members.filter((m) => !m.excluded).map((m) => m.id);
    const [totals] = visibleIds.length
        ? await database
            .select({
            sessionCount: (0, drizzle_orm_1.sql) `count(*)::int`,
            watchTime: (0, drizzle_orm_1.sql) `coalesce(sum(${schema_1.sessions.playDuration}), 0)::float8`,
        })
            .from(schema_1.sessions)
            .leftJoin(schema_1.items, (0, drizzle_orm_1.eq)(schema_1.items.id, schema_1.sessions.itemId))
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.sessions.serverId, serverId), (0, drizzle_orm_1.inArray)(schema_1.sessions.userId, visibleIds), server?.excludedLibraries?.length
            ? (0, drizzle_orm_1.sql) `(${schema_1.items.libraryId} IS NULL OR ${schema_1.items.libraryId} NOT IN (${drizzle_orm_1.sql.join(server.excludedLibraries.map((id) => (0, drizzle_orm_1.sql) `${id}`), (0, drizzle_orm_1.sql) `, `)}))`
            : undefined))
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
async function changeUserGroup({ serverId, change, previewToken, operationId, actor, database = connection_1.db, }) {
    const requestHash = hash({
        change: { ...change, memberUserIds: [...change.memberUserIds].sort() },
        previewToken,
    });
    return database.transaction(async (tx) => {
        // Serialize membership mutations per server, including group dissolution and
        // replay. Sync only updates accounts, so it cannot overwrite these records.
        const locked = await tx
            .select({ id: schema_1.servers.id })
            .from(schema_1.servers)
            .where((0, drizzle_orm_1.eq)(schema_1.servers.id, serverId))
            .for("update");
        if (!locked.length)
            throw new UserGroupError("Server not found.", 404);
        const [prior] = await tx
            .select()
            .from(schema_1.userGroupAudit)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userGroupAudit.serverId, serverId), (0, drizzle_orm_1.eq)(schema_1.userGroupAudit.operationId, operationId)));
        if (prior) {
            if (prior.requestHash !== requestHash || prior.actorId !== actor.id)
                throw new UserGroupError("Operation ID already used for a different request.", 409);
            return prior.after;
        }
        const preview = await previewUserGroup({ serverId, change, database: tx });
        if (preview.token !== previewToken)
            throw new UserGroupError("Preview expired. Review the accounts again.", 409);
        const id = change.groupId ?? (0, node_crypto_1.randomUUID)();
        const after = preview.members.length > 1
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
                    .update(schema_1.userGroups)
                    .set({
                    primaryUserId: after.primaryUserId,
                    revision: after.revision,
                    updatedAt: new Date(),
                })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userGroups.id, id), (0, drizzle_orm_1.eq)(schema_1.userGroups.serverId, serverId)));
                await tx
                    .delete(schema_1.userGroupMembers)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userGroupMembers.serverId, serverId), (0, drizzle_orm_1.eq)(schema_1.userGroupMembers.groupId, id)));
            }
            else {
                await tx
                    .insert(schema_1.userGroups)
                    .values({ id, serverId, primaryUserId: after.primaryUserId });
            }
            await tx
                .insert(schema_1.userGroupMembers)
                .values(after.memberUserIds.map((userId) => ({
                serverId,
                groupId: id,
                userId,
            })));
        }
        else {
            await tx
                .delete(schema_1.userGroups)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userGroups.id, id), (0, drizzle_orm_1.eq)(schema_1.userGroups.serverId, serverId)));
        }
        await tx
            .insert(schema_1.userGroupAudit)
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
//# sourceMappingURL=user-groups.js.map