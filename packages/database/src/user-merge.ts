import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "./connection";
import {
  activities,
  anomalyEvents,
  hiddenRecommendations,
  servers,
  sessions,
  userFingerprints,
  userMergeAudit,
  userMerges,
  users,
  watchlists,
} from "./schema";

type Database = typeof db;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Reader = Database | Transaction;
export type UserMergeInput = { sourceUserId: string; targetUserId: string };
export class UserMergeError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function runUserMergeTransaction<T>({
  serverId,
  database,
  run,
}: {
  serverId: number;
  database: Reader;
  run: (tx: Transaction) => Promise<T>;
}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await database.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(582, ${serverId})`);
        return run(tx);
      });
    } catch (error) {
      const cause = error instanceof Error && error.cause ? error.cause : error;
      if (
        attempt >= 3 ||
        typeof cause !== "object" ||
        cause === null ||
        !("code" in cause) ||
        cause.code !== "55P03"
      )
        throw error;
      // Release the merge lock so a queued sync UPDATE can finish, then retry.
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

export async function getMergedUserTarget({
  serverId,
  userId,
  database = db,
}: {
  serverId: number;
  userId: string;
  database?: Reader;
}): Promise<string | null> {
  const [alias] = await database
    .select({ target: userMerges.targetUserId })
    .from(userMerges)
    .where(
      and(
        eq(userMerges.serverId, serverId),
        eq(userMerges.sourceUserId, userId),
      ),
    );
  return alias?.target ?? null;
}

export async function getMergeAccounts({
  serverId,
  database = db,
}: {
  serverId: number;
  database?: Reader;
}) {
  return database
    .select({
      id: users.id,
      name: users.name,
      lastActivityDate: users.lastActivityDate,
    })
    .from(users)
    .where(eq(users.serverId, serverId))
    .orderBy(users.name, users.id);
}

export async function getRetiredUserIds({
  serverId,
  database = db,
}: {
  serverId: number;
  database?: Reader;
}) {
  const records = await database
    .select({ id: userMerges.sourceUserId })
    .from(userMerges)
    .where(eq(userMerges.serverId, serverId));
  return records.map((record) => record.id);
}

export async function previewUserMerge({
  serverId,
  input,
  database = db,
}: {
  serverId: number;
  input: UserMergeInput;
  database?: Reader;
}) {
  if (
    !input.sourceUserId ||
    !input.targetUserId ||
    input.sourceUserId === input.targetUserId
  )
    throw new UserMergeError("Choose two different accounts.");
  const accounts = await database
    .select()
    .from(users)
    .where(
      and(
        eq(users.serverId, serverId),
        inArray(users.id, [input.sourceUserId, input.targetUserId]),
      ),
    );
  const source = accounts.find((a) => a.id === input.sourceUserId);
  const target = accounts.find((a) => a.id === input.targetUserId);
  if (!source || !target)
    throw new UserMergeError(
      "Both accounts must still exist in Streamystats on this server. Refresh and try again.",
      409,
    );
  const sessionOwner = and(
    eq(sessions.serverId, serverId),
    or(
      eq(sessions.userId, source.id),
      and(isNull(sessions.userId), eq(sessions.userServerId, source.id)),
    ),
  );
  const [playback] = await database
    .select({
      sessions: sql<number>`count(*)::int`,
      watchTime: sql<number>`coalesce(sum(${sessions.playDuration}), 0)::float8`,
    })
    .from(sessions)
    .where(sessionOwner);
  const transferred: Record<string, number> = { sessions: playback.sessions };
  for (const [name, table] of [
    ["activities", activities],
    ["watchlists", watchlists],
    ["hiddenRecommendations", hiddenRecommendations],
    ["securityEvents", anomalyEvents],
  ] as const) {
    const [total] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(table)
      .where(and(eq(table.serverId, serverId), eq(table.userId, source.id)));
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

export async function mergeUsersPermanently({
  serverId,
  input,
  previewToken,
  operationId,
  actor,
  database = db,
}: {
  serverId: number;
  input: UserMergeInput;
  previewToken: string;
  operationId: string;
  actor: { id: string; name: string };
  database?: Reader;
}) {
  if (actor.id === input.sourceUserId)
    throw new UserMergeError(
      "Sign in with a different administrator before retiring this account.",
    );
  const requestHash = hash({ input, previewToken });
  return runUserMergeTransaction({
    serverId,
    database,
    run: async (tx) => {
      const [prior] = await tx
        .select()
        .from(userMergeAudit)
        .where(
          and(
            eq(userMergeAudit.serverId, serverId),
            eq(userMergeAudit.operationId, operationId),
          ),
        );
      if (prior) {
        if (prior.requestHash !== requestHash || prior.actorId !== actor.id)
          throw new UserMergeError("Operation ID already used.", 409);
        return {
          targetUserId: prior.targetUserId,
          transferred: prior.transferred,
        };
      }
      await tx
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.serverId, serverId),
            inArray(users.id, [input.sourceUserId, input.targetUserId]),
          ),
        )
        .orderBy(users.id)
        .for("update", { noWait: true });
      // UPDATE locks rows before its row trigger takes the shared advisory lock.
      // Never wait for those rows while holding the exclusive merge lock: release
      // and retry instead. Lock every row we will mutate before changing any data.
      await tx
        .select({ id: servers.id })
        .from(servers)
        .where(eq(servers.id, serverId))
        .for("update", { noWait: true });
      await tx
        .select({ id: sessions.id })
        .from(sessions)
        .where(
          and(
            eq(sessions.serverId, serverId),
            or(
              eq(sessions.userId, input.sourceUserId),
              and(
                isNull(sessions.userId),
                eq(sessions.userServerId, input.sourceUserId),
              ),
            ),
          ),
        )
        .for("update", { noWait: true });
      for (const table of [
        activities,
        watchlists,
        hiddenRecommendations,
        anomalyEvents,
        userFingerprints,
      ]) {
        await tx
          .select({ userId: table.userId })
          .from(table)
          .where(
            and(
              eq(table.serverId, serverId),
              inArray(table.userId, [input.sourceUserId, input.targetUserId]),
            ),
          )
          .for("update", { noWait: true });
      }
      const preview = await previewUserMerge({ serverId, input, database: tx });
      if (preview.token !== previewToken)
        throw new UserMergeError(
          "Accounts changed. Review the merge again.",
          409,
        );
      const { source, target } = preview;
      await tx.insert(userMerges).values({
        serverId,
        sourceUserId: source.id,
        sourceName: source.name,
        targetUserId: target.id,
      });
      // Flatten chains when an earlier destination is itself retired later.
      await tx
        .update(userMerges)
        .set({ targetUserId: target.id })
        .where(
          and(
            eq(userMerges.serverId, serverId),
            eq(userMerges.targetUserId, source.id),
          ),
        );
      await tx
        .update(sessions)
        .set({ userId: target.id, userName: target.name })
        .where(
          and(
            eq(sessions.serverId, serverId),
            or(
              eq(sessions.userId, source.id),
              and(
                isNull(sessions.userId),
                eq(sessions.userServerId, source.id),
              ),
            ),
          ),
        );
      for (const table of [
        activities,
        watchlists,
        hiddenRecommendations,
        anomalyEvents,
      ]) {
        await tx
          .update(table)
          .set({ userId: target.id })
          .where(
            and(eq(table.serverId, serverId), eq(table.userId, source.id)),
          );
      }
      // Hidden recommendations are a set, including duplicates imported earlier.
      await tx.execute(sql`DELETE FROM hidden_recommendations duplicate USING hidden_recommendations keeper
      WHERE duplicate.server_id = ${serverId} AND duplicate.user_id = ${target.id}
      AND keeper.server_id = duplicate.server_id AND keeper.user_id = duplicate.user_id
      AND keeper.item_id = duplicate.item_id AND keeper.id < duplicate.id`);
      await tx.execute(sql`UPDATE users destination SET infer_watchtime_on_mark_watched = COALESCE(destination.infer_watchtime_on_mark_watched, source.infer_watchtime_on_mark_watched)
      FROM users source WHERE destination.server_id = ${serverId} AND destination.id = ${target.id} AND source.id = ${source.id} AND source.server_id = ${serverId}`);
      // Derived security profiles are rebuilt from the transferred activity.
      await tx
        .delete(userFingerprints)
        .where(
          and(
            eq(userFingerprints.serverId, serverId),
            inArray(userFingerprints.userId, [source.id, target.id]),
          ),
        );
      await tx.execute(
        sql`UPDATE servers SET excluded_user_ids = array_remove(excluded_user_ids, ${source.id}) WHERE id = ${serverId}`,
      );
      await tx
        .delete(users)
        .where(and(eq(users.serverId, serverId), eq(users.id, source.id)));
      await tx.insert(userMergeAudit).values({
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
