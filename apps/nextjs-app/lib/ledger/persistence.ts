import "server-only";
import { randomUUID } from "node:crypto";
import { db, ledgerRecords } from "@streamystats/database";
import { and, eq, sql } from "drizzle-orm";
import { record, validDate } from "./engine";
import { LEDGER_RECORD_LIMIT, LEDGER_SOURCE_BYTE_LIMIT, LedgerLimitError } from "./limits";
import type { ImportedRecord } from "./import";

const stableJson = (value: unknown) =>
  JSON.stringify(value, (_key, current: unknown) => {
    const object = record(current);
    return object
      ? Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)))
      : current;
  });

export function mergeImportPayload({
  previous,
  incoming,
  useIncomingDates = false,
}: {
  previous: Record<string, unknown>;
  incoming: Record<string, unknown>;
  useIncomingDates?: boolean;
}) {
  const history = new Map<string, Record<string, unknown>>();
  for (const source of [previous.history, incoming.history]) {
    if (!Array.isArray(source)) continue;
    for (const value of source) {
      const row = record(value);
      if (!row || typeof row.key !== "string") continue;
      const before = history.get(row.key);
      const timestamp = (entry: Record<string, unknown>) =>
        validDate(entry.originalWatchedAt ?? entry.watchedAt) ?? "";
      // Explicit date corrections may move backward; normal merges still protect newer history.
      if (
        !before ||
        (useIncomingDates && Boolean(timestamp(row))) ||
        timestamp(row) >= timestamp(before)
      )
        history.set(row.key, row);
    }
  }
  const latest = (value: unknown) =>
    Array.isArray(value)
      ? value.reduce((latest: string, entry: unknown) => {
          const row = record(entry),
            date = validDate(row?.originalWatchedAt ?? row?.watchedAt) ?? "";
          return date > latest ? date : latest;
        }, "")
      : "";
  const olderSnapshot = latest(incoming.history) < latest(previous.history);
  return {
    ...previous,
    ...incoming,
    ...(olderSnapshot && previous.title ? { title: previous.title } : {}),
    ...(history.size ? { history: [...history.values()] } : {}),
  };
}

export async function saveLedgerRows({
  serverId,
  userId,
  rows,
  useIncomingDates = false,
}: {
  serverId: number;
  userId: string;
  rows: ImportedRecord[];
  useIncomingDates?: boolean;
}) {
  await db.transaction(async (tx) => {
    // One transaction per user prevents imports and resets racing with each other.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`ledger:${serverId}:${userId}`}, 0))`,
    );
    for (const row of rows) {
      let payload = row.payload;
      if (row.kind.startsWith("simkl-") || row.kind === "manual") {
        const [existing] = await tx
          .select({ payload: ledgerRecords.payload })
          .from(ledgerRecords)
          .where(
            and(
              eq(ledgerRecords.serverId, serverId),
              eq(ledgerRecords.userId, userId),
              eq(ledgerRecords.kind, row.kind),
              eq(ledgerRecords.sourceKey, row.sourceKey),
            ),
          )
          .limit(1);
        if (existing && row.kind === "manual") {
          if (stableJson(existing.payload) !== stableJson(payload))
            throw new Error(
              "That manual log was already saved. Close the form before logging a different watch.",
            );
          continue;
        }
        if (existing)
          payload = mergeImportPayload({
            previous: existing.payload,
            incoming: payload,
            useIncomingDates: useIncomingDates && row.kind === "simkl-json",
          });
      }
      await tx
        .insert(ledgerRecords)
        .values({ id: randomUUID(), serverId, userId, ...row, payload })
        .onConflictDoUpdate({
          target: [
            ledgerRecords.serverId,
            ledgerRecords.userId,
            ledgerRecords.kind,
            ledgerRecords.sourceKey,
          ],
          set: {
            payload:
              row.kind === "correction" || row.kind === "settings"
                ? sql`${ledgerRecords.payload} || ${JSON.stringify(payload)}::jsonb`
                : payload,
            updatedAt: new Date(),
          },
        });
    }
    const [size] = await tx
      .select({
        bytes: sql<number>`coalesce(sum(octet_length(${ledgerRecords.payload}::text)), 0)`,
        count: sql<number>`count(*)`,
      })
      .from(ledgerRecords)
      .where(and(eq(ledgerRecords.serverId, serverId), eq(ledgerRecords.userId, userId)));
    if (
      Number(size?.bytes ?? 0) > LEDGER_SOURCE_BYTE_LIMIT ||
      Number(size?.count ?? 0) > LEDGER_RECORD_LIMIT
    )
      throw new LedgerLimitError(
        "Import would exceed the supported limit of 10,000 ledger records or 32 MB of source data. Nothing was saved.",
      );
  });
}

export async function resetLedgerCorrections({
  serverId,
  userId,
  key,
}: {
  serverId: number;
  userId: string;
  key?: string;
}) {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`ledger:${serverId}:${userId}`}, 0))`,
    );
    await tx
      .delete(ledgerRecords)
      .where(
        and(
          eq(ledgerRecords.serverId, serverId),
          eq(ledgerRecords.userId, userId),
          eq(ledgerRecords.kind, "correction"),
          key ? eq(ledgerRecords.sourceKey, key) : undefined,
        ),
      );
  });
}
