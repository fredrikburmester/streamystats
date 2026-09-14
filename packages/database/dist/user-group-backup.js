"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportUserGroups = exportUserGroups;
exports.restoreUserGroups = restoreUserGroups;
const node_crypto_1 = require("node:crypto");
const drizzle_orm_1 = require("drizzle-orm");
const connection_1 = require("./connection");
const schema_1 = require("./schema");
const user_groups_1 = require("./user-groups");
async function exportUserGroups({ serverId, database = connection_1.db, }) {
    return database.transaction(async (tx) => {
        await tx
            .select({ id: schema_1.servers.id })
            .from(schema_1.servers)
            .where((0, drizzle_orm_1.eq)(schema_1.servers.id, serverId))
            .for("share");
        const [groups, accounts] = await Promise.all([
            (0, user_groups_1.getUserGroups)({ serverId, database: tx }),
            (0, user_groups_1.getUserGroupAccounts)({ serverId, database: tx }),
        ]);
        const memberIds = new Set(groups.flatMap((g) => g.memberUserIds));
        return {
            accounts: accounts
                .filter((a) => memberIds.has(a.id))
                .map((a) => ({ id: a.id, name: a.name })),
            groups: groups.map((g) => ({
                primaryUserId: g.primaryUserId,
                memberUserIds: g.memberUserIds,
            })),
        };
    });
}
async function restoreUserGroups({ serverId, backup, actor, database = connection_1.db, }) {
    await database.transaction(async (tx) => {
        const locked = await tx
            .select({ id: schema_1.servers.id })
            .from(schema_1.servers)
            .where((0, drizzle_orm_1.eq)(schema_1.servers.id, serverId))
            .for("update");
        if (!locked.length)
            throw new user_groups_1.UserGroupError("Server not found.", 404);
        const memberIds = backup.groups.flatMap((g) => g.memberUserIds);
        if (new Set(memberIds).size !== memberIds.length ||
            new Set(backup.accounts.map((a) => a.id)).size !== backup.accounts.length)
            throw new user_groups_1.UserGroupError("Backup contains duplicate memberships.");
        const names = new Map(backup.accounts.map((a) => [a.id, a.name]));
        if (memberIds.some((id) => !names.has(id)) ||
            backup.accounts.some((a) => !memberIds.includes(a.id)))
            throw new user_groups_1.UserGroupError("Backup member identities do not match its groups.");
        for (const group of backup.groups) {
            if (group.memberUserIds.length < 2 ||
                !group.memberUserIds.includes(group.primaryUserId))
                throw new user_groups_1.UserGroupError("Invalid group in backup.");
        }
        if (!memberIds.length)
            return;
        const accounts = await tx
            .select({ id: schema_1.users.id, serverId: schema_1.users.serverId })
            .from(schema_1.users)
            .where((0, drizzle_orm_1.inArray)(schema_1.users.id, memberIds));
        if (accounts.some((a) => a.serverId !== serverId))
            throw new user_groups_1.UserGroupError("An account ID already belongs to another server. Explicit account mapping is required.", 409);
        const existing = await (0, user_groups_1.getUserGroups)({ serverId, database: tx });
        const pending = backup.groups.filter((group) => {
            const overlap = existing.filter((g) => g.memberUserIds.some((id) => group.memberUserIds.includes(id)));
            if (!overlap.length)
                return true;
            const same = overlap.length === 1 &&
                overlap[0]?.primaryUserId === group.primaryUserId &&
                [...group.memberUserIds].sort().join("\0") ===
                    overlap[0].memberUserIds.join("\0");
            if (!same)
                throw new user_groups_1.UserGroupError("Backup conflicts with existing merged accounts. Unlink or explicitly map those accounts before restoring.", 409);
            return false;
        });
        const known = new Set(accounts.map((a) => a.id));
        const historical = backup.accounts.filter((a) => !known.has(a.id));
        if (historical.length)
            await tx.insert(schema_1.users).values(historical.map((a) => ({
                id: a.id,
                name: a.name,
                serverId,
                isDisabled: true,
                isAdministrator: false,
                enableAllFolders: false,
                enabledFolders: [],
                enableMediaPlayback: false,
                enableUserPreferenceAccess: false,
            })));
        for (const group of pending) {
            const id = (0, node_crypto_1.randomUUID)();
            const after = {
                ...group,
                memberUserIds: [...group.memberUserIds].sort(),
                serverId,
                id,
                revision: 1,
            };
            await tx
                .insert(schema_1.userGroups)
                .values({ id, serverId, primaryUserId: group.primaryUserId });
            await tx
                .insert(schema_1.userGroupMembers)
                .values(group.memberUserIds.map((userId) => ({
                serverId,
                groupId: id,
                userId,
            })));
            await tx.insert(schema_1.userGroupAudit).values({
                serverId,
                operationId: (0, node_crypto_1.randomUUID)(),
                actorId: actor.id,
                actorName: actor.name,
                requestHash: (0, node_crypto_1.createHash)("sha256")
                    .update(JSON.stringify({ restore: after }))
                    .digest("hex"),
                before: null,
                after,
            });
        }
    });
}
//# sourceMappingURL=user-group-backup.js.map