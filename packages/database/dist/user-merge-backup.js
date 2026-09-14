"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportMergedUserData = exportMergedUserData;
exports.restoreUserMerges = restoreUserMerges;
const node_crypto_1 = require("node:crypto");
const drizzle_orm_1 = require("drizzle-orm");
const connection_1 = require("./connection");
const schema_1 = require("./schema");
const user_merge_1 = require("./user-merge");
async function exportMergedUserData({ serverId, database = connection_1.db, }) {
    return database.transaction(async (tx) => {
        await tx.execute((0, drizzle_orm_1.sql) `SELECT pg_advisory_xact_lock_shared(582, ${serverId})`);
        const retiredUsers = await tx
            .select({
            sourceUserId: schema_1.userMerges.sourceUserId,
            sourceName: schema_1.userMerges.sourceName,
            targetUserId: schema_1.userMerges.targetUserId,
        })
            .from(schema_1.userMerges)
            .where((0, drizzle_orm_1.eq)(schema_1.userMerges.serverId, serverId));
        const targetIds = [...new Set(retiredUsers.map((row) => row.targetUserId))];
        const accounts = targetIds.length
            ? await tx
                .select({ id: schema_1.users.id, name: schema_1.users.name })
                .from(schema_1.users)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.serverId, serverId), (0, drizzle_orm_1.inArray)(schema_1.users.id, targetIds)))
            : [];
        return {
            sessions: await tx
                .select()
                .from(schema_1.sessions)
                .where((0, drizzle_orm_1.eq)(schema_1.sessions.serverId, serverId)),
            hiddenRecommendations: await tx
                .select()
                .from(schema_1.hiddenRecommendations)
                .where((0, drizzle_orm_1.eq)(schema_1.hiddenRecommendations.serverId, serverId)),
            userMerges: { retiredUsers, accounts },
        };
    });
}
async function restoreUserMerges({ serverId, backup, actor, database = connection_1.db, }) {
    await (0, user_merge_1.runUserMergeTransaction)({
        serverId,
        database,
        run: async (tx) => {
            const sourceIds = backup.retiredUsers.map((row) => row.sourceUserId);
            const targetIds = [
                ...new Set(backup.retiredUsers.map((row) => row.targetUserId)),
            ];
            if (new Set(sourceIds).size !== sourceIds.length ||
                targetIds.some((id) => sourceIds.includes(id)) ||
                new Set(backup.accounts.map((a) => a.id)).size !==
                    backup.accounts.length ||
                backup.accounts.length !== targetIds.length ||
                targetIds.some((id) => !backup.accounts.some((a) => a.id === id)))
                throw new user_merge_1.UserMergeError("Invalid permanent merge metadata.");
            if (!sourceIds.length)
                return;
            const existing = await tx
                .select()
                .from(schema_1.users)
                .where((0, drizzle_orm_1.inArray)(schema_1.users.id, [...sourceIds, ...targetIds]));
            if (existing.some((a) => a.serverId !== serverId))
                throw new user_merge_1.UserMergeError("An account belongs to another server. Explicit account mapping is required.", 409);
            const aliases = await tx
                .select()
                .from(schema_1.userMerges)
                .where((0, drizzle_orm_1.eq)(schema_1.userMerges.serverId, serverId));
            if (targetIds.some((id) => aliases.some((a) => a.sourceUserId === id)) ||
                backup.retiredUsers.some((row) => aliases.some((a) => a.sourceUserId === row.sourceUserId &&
                    a.targetUserId !== row.targetUserId)))
                throw new user_merge_1.UserMergeError("Backup conflicts with existing permanent merges.", 409);
            for (const account of backup.accounts) {
                if (!existing.some((a) => a.id === account.id))
                    await tx.insert(schema_1.users).values({
                        ...account,
                        serverId,
                        isDisabled: true,
                        isAdministrator: false,
                        enableAllFolders: false,
                        enabledFolders: [],
                        enableMediaPlayback: false,
                        enableUserPreferenceAccess: false,
                    });
            }
            for (const row of backup.retiredUsers) {
                if (aliases.some((a) => a.sourceUserId === row.sourceUserId))
                    continue;
                if (existing.some((a) => a.id === row.sourceUserId)) {
                    const preview = await (0, user_merge_1.previewUserMerge)({
                        serverId,
                        input: row,
                        database: tx,
                    });
                    await (0, user_merge_1.mergeUsersPermanently)({
                        serverId,
                        input: row,
                        previewToken: preview.token,
                        operationId: (0, node_crypto_1.randomUUID)(),
                        actor,
                        database: tx,
                    });
                }
                else {
                    const target = backup.accounts.find((a) => a.id === row.targetUserId);
                    if (!target)
                        throw new user_merge_1.UserMergeError("Missing destination account metadata.");
                    await tx.insert(schema_1.userMerges).values({ ...row, serverId });
                    await tx.insert(schema_1.userMergeAudit).values({
                        serverId,
                        ...row,
                        targetName: target.name,
                        actorId: actor.id,
                        actorName: actor.name,
                        operationId: (0, node_crypto_1.randomUUID)(),
                        requestHash: (0, node_crypto_1.createHash)("sha256")
                            .update(JSON.stringify(row))
                            .digest("hex"),
                        transferred: {},
                    });
                }
            }
        },
    });
}
//# sourceMappingURL=user-merge-backup.js.map