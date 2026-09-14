"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserMergeError = void 0;
exports.runUserMergeTransaction = runUserMergeTransaction;
exports.getMergedUserTarget = getMergedUserTarget;
exports.getMergeAccounts = getMergeAccounts;
exports.getRetiredUserIds = getRetiredUserIds;
exports.previewUserMerge = previewUserMerge;
exports.mergeUsersPermanently = mergeUsersPermanently;
const node_crypto_1 = require("node:crypto");
const drizzle_orm_1 = require("drizzle-orm");
const connection_1 = require("./connection");
const schema_1 = require("./schema");
class UserMergeError extends Error {
    status;
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
exports.UserMergeError = UserMergeError;
const hash = (value) => (0, node_crypto_1.createHash)("sha256").update(JSON.stringify(value)).digest("hex");
async function runUserMergeTransaction({ serverId, database, run, }) {
    for (let attempt = 0;; attempt++) {
        try {
            return await database.transaction(async (tx) => {
                await tx.execute((0, drizzle_orm_1.sql) `SELECT pg_advisory_xact_lock(582, ${serverId})`);
                return run(tx);
            });
        }
        catch (error) {
            const cause = error instanceof Error && error.cause ? error.cause : error;
            if (attempt >= 3 ||
                typeof cause !== "object" ||
                cause === null ||
                !("code" in cause) ||
                cause.code !== "55P03")
                throw error;
            // Release the merge lock so a queued sync UPDATE can finish, then retry.
            await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
        }
    }
}
async function getMergedUserTarget({ serverId, userId, database = connection_1.db, }) {
    const [alias] = await database
        .select({ target: schema_1.userMerges.targetUserId })
        .from(schema_1.userMerges)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userMerges.serverId, serverId), (0, drizzle_orm_1.eq)(schema_1.userMerges.sourceUserId, userId)));
    return alias?.target ?? null;
}
async function getMergeAccounts({ serverId, database = connection_1.db, }) {
    return database
        .select({
        id: schema_1.users.id,
        name: schema_1.users.name,
        lastActivityDate: schema_1.users.lastActivityDate,
    })
        .from(schema_1.users)
        .where((0, drizzle_orm_1.eq)(schema_1.users.serverId, serverId))
        .orderBy(schema_1.users.name, schema_1.users.id);
}
async function getRetiredUserIds({ serverId, database = connection_1.db, }) {
    const records = await database
        .select({ id: schema_1.userMerges.sourceUserId })
        .from(schema_1.userMerges)
        .where((0, drizzle_orm_1.eq)(schema_1.userMerges.serverId, serverId));
    return records.map((record) => record.id);
}
async function previewUserMerge({ serverId, input, database = connection_1.db, }) {
    if (!input.sourceUserId ||
        !input.targetUserId ||
        input.sourceUserId === input.targetUserId)
        throw new UserMergeError("Choose two different accounts.");
    const accounts = await database
        .select()
        .from(schema_1.users)
        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.serverId, serverId), (0, drizzle_orm_1.inArray)(schema_1.users.id, [input.sourceUserId, input.targetUserId])));
    const source = accounts.find((a) => a.id === input.sourceUserId);
    const target = accounts.find((a) => a.id === input.targetUserId);
    if (!source || !target)
        throw new UserMergeError("Both accounts must still exist in Streamystats on this server. Refresh and try again.", 409);
    const sessionOwner = (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.sessions.serverId, serverId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.sessions.userId, source.id), (0, drizzle_orm_1.and)((0, drizzle_orm_1.isNull)(schema_1.sessions.userId), (0, drizzle_orm_1.eq)(schema_1.sessions.userServerId, source.id))));
    const [playback] = await database
        .select({
        sessions: (0, drizzle_orm_1.sql) `count(*)::int`,
        watchTime: (0, drizzle_orm_1.sql) `coalesce(sum(${schema_1.sessions.playDuration}), 0)::float8`,
    })
        .from(schema_1.sessions)
        .where(sessionOwner);
    const transferred = { sessions: playback.sessions };
    for (const [name, table] of [
        ["activities", schema_1.activities],
        ["watchlists", schema_1.watchlists],
        ["hiddenRecommendations", schema_1.hiddenRecommendations],
        ["securityEvents", schema_1.anomalyEvents],
    ]) {
        const [total] = await database
            .select({ count: (0, drizzle_orm_1.sql) `count(*)::int` })
            .from(table)
            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(table.serverId, serverId), (0, drizzle_orm_1.eq)(table.userId, source.id)));
        transferred[name] = total.count;
    }
    return {
        source: { id: source.id, name: source.name },
        target: { id: target.id, name: target.name },
        transferred,
        watchTime: playback.watchTime,
        // Playback can arrive between preview and confirmation. All rows are moved
        // atomically; only changes to account identity/settings invalidate consent.
        token: hash({
            serverId,
            input,
            sourceName: source.name,
            targetName: target.name,
            sourcePreference: source.inferWatchtimeOnMarkWatched,
            targetPreference: target.inferWatchtimeOnMarkWatched,
        }),
    };
}
async function mergeUsersPermanently({ serverId, input, previewToken, operationId, actor, database = connection_1.db, }) {
    if (actor.id === input.sourceUserId)
        throw new UserMergeError("Sign in with a different administrator before retiring this account.");
    const requestHash = hash({ input, previewToken });
    return runUserMergeTransaction({
        serverId,
        database,
        run: async (tx) => {
            const [prior] = await tx
                .select()
                .from(schema_1.userMergeAudit)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userMergeAudit.serverId, serverId), (0, drizzle_orm_1.eq)(schema_1.userMergeAudit.operationId, operationId)));
            if (prior) {
                if (prior.requestHash !== requestHash || prior.actorId !== actor.id)
                    throw new UserMergeError("Operation ID already used.", 409);
                return {
                    targetUserId: prior.targetUserId,
                    transferred: prior.transferred,
                };
            }
            await tx
                .select({ id: schema_1.users.id })
                .from(schema_1.users)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.serverId, serverId), (0, drizzle_orm_1.inArray)(schema_1.users.id, [input.sourceUserId, input.targetUserId])))
                .orderBy(schema_1.users.id)
                .for("update", { noWait: true });
            // UPDATE locks rows before its row trigger takes the shared advisory lock.
            // Never wait for those rows while holding the exclusive merge lock: release
            // and retry instead. Lock every row we will mutate before changing any data.
            await tx
                .select({ id: schema_1.servers.id })
                .from(schema_1.servers)
                .where((0, drizzle_orm_1.eq)(schema_1.servers.id, serverId))
                .for("update", { noWait: true });
            await tx
                .select({ id: schema_1.sessions.id })
                .from(schema_1.sessions)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.sessions.serverId, serverId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.sessions.userId, input.sourceUserId), (0, drizzle_orm_1.and)((0, drizzle_orm_1.isNull)(schema_1.sessions.userId), (0, drizzle_orm_1.eq)(schema_1.sessions.userServerId, input.sourceUserId)))))
                .for("update", { noWait: true });
            for (const table of [
                schema_1.activities,
                schema_1.watchlists,
                schema_1.hiddenRecommendations,
                schema_1.anomalyEvents,
                schema_1.userFingerprints,
            ]) {
                await tx
                    .select({ userId: table.userId })
                    .from(table)
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(table.serverId, serverId), (0, drizzle_orm_1.inArray)(table.userId, [input.sourceUserId, input.targetUserId])))
                    .for("update", { noWait: true });
            }
            const preview = await previewUserMerge({ serverId, input, database: tx });
            if (preview.token !== previewToken)
                throw new UserMergeError("Accounts changed. Review the merge again.", 409);
            const { source, target } = preview;
            await tx.insert(schema_1.userMerges).values({
                serverId,
                sourceUserId: source.id,
                sourceName: source.name,
                targetUserId: target.id,
            });
            // Flatten chains when an earlier destination is itself retired later.
            await tx
                .update(schema_1.userMerges)
                .set({ targetUserId: target.id })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userMerges.serverId, serverId), (0, drizzle_orm_1.eq)(schema_1.userMerges.targetUserId, source.id)));
            await tx
                .update(schema_1.sessions)
                .set({ userId: target.id, userName: target.name })
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.sessions.serverId, serverId), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_1.sessions.userId, source.id), (0, drizzle_orm_1.and)((0, drizzle_orm_1.isNull)(schema_1.sessions.userId), (0, drizzle_orm_1.eq)(schema_1.sessions.userServerId, source.id)))));
            for (const table of [
                schema_1.activities,
                schema_1.watchlists,
                schema_1.hiddenRecommendations,
                schema_1.anomalyEvents,
            ]) {
                await tx
                    .update(table)
                    .set({ userId: target.id })
                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(table.serverId, serverId), (0, drizzle_orm_1.eq)(table.userId, source.id)));
            }
            // Hidden recommendations are a set, including duplicates imported earlier.
            await tx.execute((0, drizzle_orm_1.sql) `DELETE FROM hidden_recommendations duplicate USING hidden_recommendations keeper
      WHERE duplicate.server_id = ${serverId} AND duplicate.user_id = ${target.id}
      AND keeper.server_id = duplicate.server_id AND keeper.user_id = duplicate.user_id
      AND keeper.item_id = duplicate.item_id AND keeper.id < duplicate.id`);
            await tx.execute((0, drizzle_orm_1.sql) `UPDATE users destination SET infer_watchtime_on_mark_watched = COALESCE(destination.infer_watchtime_on_mark_watched, source.infer_watchtime_on_mark_watched)
      FROM users source WHERE destination.server_id = ${serverId} AND destination.id = ${target.id} AND source.id = ${source.id} AND source.server_id = ${serverId}`);
            // Derived security profiles are rebuilt from the transferred activity.
            await tx
                .delete(schema_1.userFingerprints)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.userFingerprints.serverId, serverId), (0, drizzle_orm_1.inArray)(schema_1.userFingerprints.userId, [source.id, target.id])));
            await tx.execute((0, drizzle_orm_1.sql) `UPDATE servers SET excluded_user_ids = array_remove(excluded_user_ids, ${source.id}) WHERE id = ${serverId}`);
            await tx
                .delete(schema_1.users)
                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.users.serverId, serverId), (0, drizzle_orm_1.eq)(schema_1.users.id, source.id)));
            await tx.insert(schema_1.userMergeAudit).values({
                serverId,
                operationId,
                actorId: actor.id,
                actorName: actor.name,
                requestHash,
                sourceUserId: source.id,
                sourceName: source.name,
                targetUserId: target.id,
                targetName: target.name,
                transferred: preview.transferred,
            });
            return { targetUserId: target.id, transferred: preview.transferred };
        },
    });
}
//# sourceMappingURL=user-merge.js.map