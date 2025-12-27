import {
  db,
  activities,
  activeSessions,
  activityLogCursors,
  servers,
  sessions,
  users,
  type NewActivity,
  type NewActiveSession,
  type NewActivityLogCursor,
  type NewSession,
  type Server,
} from "@streamystats/database";
import { JellyfinClient, type JellyfinActivity } from "../jellyfin/client";
import {
  JellyfinSession,
  TrackedSession,
  ActiveSessionResponse,
} from "../jellyfin/types";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import pLimit from "p-limit";
import { formatError } from "../utils/format-error";
import { shouldLog } from "../utils/log-throttle";
import { normalizeTimeoutMs } from "../utils/sleep";

// Timeout for individual poll operations (30 seconds)
const POLL_TIMEOUT_MS = 30_000;
// Max time a poll can run before watchdog considers it stuck (60 seconds)
const WATCHDOG_THRESHOLD_MS = 60_000;
// How often to log heartbeats showing poller is alive (5 minutes)
const HEARTBEAT_LOG_INTERVAL_MS = 5 * 60_000;
// Default per-server request timeout (fail fast, let backoff handle longer outages)
// Increased to reduce false "server down" during Jellyfin load spikes / cold starts.
const DEFAULT_SERVER_REQUEST_TIMEOUT_MS = 15_000;
// Default server poll concurrency
const DEFAULT_SERVER_CONCURRENCY = 3;
// DB statement timeout to prevent DB stalls from wedging session tracking
const DB_STATEMENT_TIMEOUT_MS = 10_000;
// How many activity log entries to check each cycle (newest-first)
const DEFAULT_ACTIVITY_LOG_LIMIT = 100;

function setLocalStatementTimeoutSql(ms: number) {
  const safeMs = Math.max(0, Math.floor(ms));
  // Postgres does not accept bind params here (SET ... = $1), so we must inline.
  return sql.raw(`SET LOCAL statement_timeout = ${safeMs}`);
}

function log(
  prefix: string,
  data: Record<string, string | number | boolean | null | undefined>
): void {
  const parts = [`[${prefix}]`];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null) {
      parts.push(`${key}=${value}`);
    }
  }
  process.stdout.write(`${parts.join(" ")}\n`);
}

interface SessionPollerConfig {
  intervalMs?: number;
  enabled?: boolean;
  pollTimeoutMs?: number;
  serverRequestTimeoutMs?: number;
  serverConcurrency?: number;
}

interface SessionChanges {
  newSessions: JellyfinSession[];
  updatedSessions: JellyfinSession[];
  endedSessions: Array<{ key: string; session: TrackedSession }>;
}

class SessionPoller {
  private trackedSessions: Map<string, Map<string, TrackedSession>> = new Map();
  private timerId: NodeJS.Timeout | null = null;
  private config: Required<SessionPollerConfig>;
  private pollInProgress = false;
  private pollStartedAt: number | null = null;
  private lastSuccessfulPoll: number = 0;
  private lastHeartbeatLog: number = 0;
  private consecutiveFailures = 0;
  private totalPollCount = 0;
  private totalSuccessCount = 0;
  private totalTimeoutCount = 0;
  private lastTimeoutAtMs: number | null = null;
  private lastCycleDurationMs: number | null = null;
  private stopRequested = false;
  private currentAbortController: AbortController | null = null;
  private inFlightServerControllers: Map<number, AbortController> = new Map();
  private serverBackoff: Map<number, { failures: number; nextAllowedAtMs: number }> =
    new Map();
  private activityCursorByServerId: Map<
    number,
    { cursorDate: Date | null; cursorId: string | null }
  > = new Map();

  private abortInFlight(_reason: string): void {
    for (const controller of this.inFlightServerControllers.values()) {
      controller.abort();
    }
    this.inFlightServerControllers.clear();
  }

  private countTrackedSessions(): number {
    let total = 0;
    for (const m of this.trackedSessions.values()) {
      total += m.size;
    }
    return total;
  }

  constructor(config: SessionPollerConfig = {}) {
    const envIntervalMs = Bun.env.SESSION_POLL_INTERVAL_MS
      ? Number.parseInt(Bun.env.SESSION_POLL_INTERVAL_MS, 10)
      : undefined;
    const envServerTimeoutMs = Bun.env.SESSION_POLL_SERVER_TIMEOUT_MS
      ? Number.parseInt(Bun.env.SESSION_POLL_SERVER_TIMEOUT_MS, 10)
      : undefined;
    const envServerConcurrency = Bun.env.SESSION_POLL_SERVER_CONCURRENCY
      ? Number.parseInt(Bun.env.SESSION_POLL_SERVER_CONCURRENCY, 10)
      : undefined;
    this.config = {
      intervalMs: config.intervalMs || envIntervalMs || 5000, // 5 seconds default
      enabled: config.enabled ?? true,
      pollTimeoutMs: config.pollTimeoutMs ?? POLL_TIMEOUT_MS,
      serverRequestTimeoutMs:
        config.serverRequestTimeoutMs ??
        envServerTimeoutMs ??
        DEFAULT_SERVER_REQUEST_TIMEOUT_MS,
      serverConcurrency:
        config.serverConcurrency ??
        envServerConcurrency ??
        DEFAULT_SERVER_CONCURRENCY,
    };
  }

  /**
   * Start the session poller
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      log("session-poller", { action: "disabled" });
      return;
    }

    if (this.timerId) {
      log("session-poller", { action: "already-running" });
      return;
    }

    this.stopRequested = false;

    log("session-poller", {
      action: "start",
      intervalMs: this.config.intervalMs,
      pollTimeoutMs: this.config.pollTimeoutMs,
      serverRequestTimeoutMs: this.config.serverRequestTimeoutMs,
      serverConcurrency: this.config.serverConcurrency,
    });

    // Load any previously persisted active sessions & activity cursors (survives restart)
    await this.loadPersistedState();

    // Initial cycle (awaited)
    await this.runPollCycle();

    // Self-scheduling loop: avoids overlap and drift issues from setInterval
    this.scheduleNextCycle();

    log("session-poller", { action: "started" });
  }

  private scheduleNextCycle(): void {
    if (this.stopRequested) return;

    const delayMs = normalizeTimeoutMs(this.config.intervalMs);
    this.timerId = setTimeout(() => {
      void this
        .runPollCycle()
        .catch((error) => {
          console.error(
            `[session-poller] action=cycle-error error=${formatError(error)}`
          );
        })
        .finally(() => {
          this.scheduleNextCycle();
        });
    }, delayMs);
  }

  /**
   * Run a single poll cycle with watchdog checks
   */
  private async runPollCycle(): Promise<void> {
    const cycleStartMs = Date.now();
    const now = Date.now();

    // Watchdog: check if previous poll is stuck
    if (this.pollInProgress && this.pollStartedAt) {
      const pollDuration = now - this.pollStartedAt;
      if (pollDuration > WATCHDOG_THRESHOLD_MS) {
        console.error(
          `[session-poller] action=watchdog-recovery pollStuckMs=${pollDuration} ` +
            `lastSuccess=${now - this.lastSuccessfulPoll}ms ago`
        );
        // Abort any in-flight work (real cancellation for Jellyfin requests)
        this.abortInFlight("watchdog");
        this.currentAbortController?.abort();
        // Don't start a new cycle while old one is still in progress; wait for it to unwind.
        return;
      } else {
        // Poll still running but within threshold, skip this cycle
        return;
      }
    }

    // Heartbeat logging
    if (now - this.lastHeartbeatLog >= HEARTBEAT_LOG_INTERVAL_MS) {
      this.lastHeartbeatLog = now;
      log("session-poller", {
        action: "heartbeat",
        totalPolls: this.totalPollCount,
        successRate: this.totalPollCount > 0
          ? Math.round((this.totalSuccessCount / this.totalPollCount) * 100)
          : 100,
        trackedServers: this.trackedSessions.size,
        trackedSessions: this.countTrackedSessions(),
        lastSuccessAgoMs: this.lastSuccessfulPoll > 0 ? now - this.lastSuccessfulPoll : 0,
        backoffServers: this.serverBackoff.size,
      });
    }

    await this.runPollWithTimeout();
    this.lastCycleDurationMs = Date.now() - cycleStartMs;
  }

  /**
   * Run poll with timeout protection
   */
  private async runPollWithTimeout(): Promise<void> {
    if (this.pollInProgress) return;

    this.pollInProgress = true;
    this.pollStartedAt = Date.now();
    this.totalPollCount++;

    const controller = new AbortController();
    this.currentAbortController = controller;

    const timeoutMs = normalizeTimeoutMs(this.config.pollTimeoutMs);
    const timeoutId = setTimeout(() => {
      this.totalTimeoutCount++;
      this.lastTimeoutAtMs = Date.now();
      this.abortInFlight("poll-timeout");
      controller.abort();
    }, timeoutMs);

    try {
      await this.pollSessions(controller.signal);

      // Poll succeeded
      this.lastSuccessfulPoll = Date.now();
      this.totalSuccessCount++;
      this.consecutiveFailures = 0;
    } catch (error) {
      this.consecutiveFailures++;
      const errorMsg = formatError(error);

      // Only log if not suppressed
      if (shouldLog("session-poller:poll-error", 30_000)) {
        console.error(
          `[session-poller] action=poll-error consecutiveFailures=${this.consecutiveFailures} error=${errorMsg}`
        );
      }

      if (controller.signal.aborted) {
        if (shouldLog("session-poller:poll-timeout", 30_000)) {
          console.error(
            `[session-poller] action=poll-timeout timeoutMs=${timeoutMs} consecutiveFailures=${this.consecutiveFailures}`
          );
        }
      }

      // Alert if too many consecutive failures
      if (this.consecutiveFailures >= 10 && this.consecutiveFailures % 10 === 0) {
        console.error(
          `[session-poller] action=degraded consecutiveFailures=${this.consecutiveFailures} ` +
            `lastSuccessAgoMs=${Date.now() - this.lastSuccessfulPoll}`
        );
      }
    } finally {
      clearTimeout(timeoutId);
      this.pollInProgress = false;
      this.pollStartedAt = null;
      this.currentAbortController = null;
    }
  }

  /**
   * Stop the session poller.
   *
   * IMPORTANT: This is async so we can flush open sessions durably before returning.
   */
  async stop(): Promise<void> {
    log("session-poller", { action: "stopping" });

    this.stopRequested = true;

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    // Abort network calls (Jellyfin), but do not abort DB finalize.
    this.abortInFlight("stop");
    this.currentAbortController?.abort();
    this.currentAbortController = null;

    await this.flushSessions();

    log("session-poller", { action: "stopped" });
  }

  /**
   * Get active sessions for a specific server
   */
  getActiveSessions(serverId: number): ActiveSessionResponse[] {
    const serverKey = `server_${serverId}`;
    const trackedSessions = this.trackedSessions.get(serverKey) || new Map();

    return Array.from(trackedSessions.values()).map((session) => ({
      sessionKey: session.sessionKey,
      userJellyfinId: session.userJellyfinId,
      userName: session.userName,
      clientName: session.clientName,
      deviceId: session.deviceId,
      deviceName: session.deviceName,
      itemId: session.itemId,
      itemName: session.itemName,
      seriesId: session.seriesId,
      seriesName: session.seriesName,
      seasonId: session.seasonId,
      positionTicks: session.positionTicks,
      runtimeTicks: session.runtimeTicks,
      playDuration: session.playDuration,
      startTime: session.startTime,
      lastActivityDate: session.lastActivityDate,
      isPaused: session.isPaused,
      playMethod: session.playMethod,
    }));
  }

  /**
   * Poll all servers for session updates
   */
  private async pollSessions(signal: AbortSignal): Promise<void> {
    try {
      const activeServers = await this.listServers();

      const limit = pLimit(
        Math.max(1, Math.floor(this.config.serverConcurrency))
      );

      const tasks: Array<Promise<void>> = [];
      for (const server of activeServers) {
        if (!this.shouldPollServer(server.id)) continue;
        tasks.push(limit(() => this.pollServer(server, signal)));
      }

      const results = await Promise.allSettled(tasks);
      let rejectedCount = 0;
      for (const r of results) {
        if (r.status === "rejected") rejectedCount += 1;
      }
      if (
        rejectedCount > 0 &&
        shouldLog("session-poller:server-task-rejected", 30_000)
      ) {
        console.error(
          `[session-poller] action=server-task-rejected count=${rejectedCount}`
        );
      }
    } catch (error) {
      console.error(
        `[session-poller] action=error error=${formatError(error)}`
      );
    }
  }

  private shouldPollServer(serverId: number): boolean {
    const entry = this.serverBackoff.get(serverId);
    if (!entry) return true;
    return Date.now() >= entry.nextAllowedAtMs;
  }

  private clearBackoff(serverId: number): void {
    this.serverBackoff.delete(serverId);
  }

  private recordFailure(serverId: number): number {
    const prev = this.serverBackoff.get(serverId);
    const failures = (prev?.failures ?? 0) + 1;

    // Less aggressive backoff: start at 10s, cap at 2 minutes
    // This ensures we retry reasonably quickly while still reducing load on failing servers
    const initialBackoffMs = 10_000;
    const maxBackoffMs = 2 * 60_000;
    const backoffMs = Math.min(
      maxBackoffMs,
      initialBackoffMs * Math.pow(1.5, failures - 1) // 1.5x growth instead of 2x
    );

    this.serverBackoff.set(serverId, {
      failures,
      nextAllowedAtMs: Date.now() + backoffMs,
    });

    return Math.round(backoffMs);
  }

  /**
   * List all active servers
   */
  private async listServers(): Promise<Server[]> {
    return await db.transaction(async (tx) => {
      await tx.execute(setLocalStatementTimeoutSql(DB_STATEMENT_TIMEOUT_MS));
      return await tx.select().from(servers);
    });
  }

  /**
   * Poll sessions for a specific server
   */
  private async pollServer(server: Server, signal: AbortSignal): Promise<void> {
    const hadBackoff = this.serverBackoff.has(server.id);
    const controller = new AbortController();
    const serverTimeoutMs = Math.max(1000, this.config.serverRequestTimeoutMs);
    this.inFlightServerControllers.set(server.id, controller);

    const onCycleAbort = () => controller.abort();
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onCycleAbort, { once: true });

    try {
      const client = JellyfinClient.fromServer(server);
      const currentSessions = await client.getSessions({
        timeoutMs: serverTimeoutMs,
        retries: 0,
        signal: controller.signal,
      });
      await this.processSessions(server, currentSessions);

      // Best-effort activity log catch-up (do not affect session backoff if this fails)
      await this.catchUpActivityLog(server, client, controller.signal);

      if (hadBackoff) {
        this.clearBackoff(server.id);
        const key = `session-poller:recovered:${server.id}`;
        if (shouldLog(key, 60_000)) {
          log("session-poller", { action: "recovered", serverId: server.id });
        }
      }
    } catch (error) {
      // If we canceled this request (cycle timeout/watchdog/stop), do NOT mark server as down.
      if (controller.signal.aborted || this.stopRequested || signal.aborted) {
        const signature = formatError(error);
        const key = `session-poller:fetch-canceled:${server.id}`;
        if (shouldLog(key, 60_000)) {
          console.info(
            `[session-poller] action=fetch-canceled serverId=${server.id} error=${signature}`
          );
        }
      } else {
      const backoffMs = this.recordFailure(server.id);
      const signature = formatError(error);
      const key = `session-poller:fetch-error:${server.id}`;

      if (shouldLog(key, Math.max(60_000, backoffMs))) {
        console.error(
          `[session-poller] action=fetch-error serverId=${server.id} backoffMs=${backoffMs} error=${signature}`
        );
      }
      }
    } finally {
      this.inFlightServerControllers.delete(server.id);
      signal.removeEventListener("abort", onCycleAbort);
    }
  }

  /**
   * Process sessions for a server
   */
  private async processSessions(
    server: Server,
    currentSessions: JellyfinSession[]
  ): Promise<void> {
    const serverKey = `server_${server.id}`;
    const trackedSessions = this.trackedSessions.get(serverKey) || new Map();

    const filteredSessions = this.filterValidSessions(currentSessions);

    const changes = this.detectSessionChanges(
      filteredSessions,
      trackedSessions
    );

    const newTracked = await this.handleNewSessions(
      server,
      changes.newSessions
    );
    const mergedSessions = new Map([...trackedSessions, ...newTracked]);

    const updatedSessions = await this.handleUpdatedSessions(
      server,
      changes.updatedSessions,
      mergedSessions
    );
    const finalSessions = await this.handleEndedSessions(
      server,
      changes.endedSessions,
      updatedSessions
    );

    this.trackedSessions.set(serverKey, finalSessions);

    // Persist all still-open sessions every cycle
    try {
      await this.persistActiveSessions(server.id, finalSessions);
    } catch (error) {
      const signature = formatError(error);
      const key = `session-poller:active-sessions-persist-error:${server.id}`;
      if (shouldLog(key, 60_000)) {
        console.error(
          `[session-poller] action=active-sessions-persist-error serverId=${server.id} error=${signature}`
        );
      }
    }
  }

  private serializeTrackedSession(session: TrackedSession): Record<string, unknown> {
    const toIso = (d: Date | undefined) => (d ? d.toISOString() : null);
    return {
      ...session,
      startTime: toIso(session.startTime),
      lastActivityDate: toIso(session.lastActivityDate),
      lastPlaybackCheckIn: toIso(session.lastPlaybackCheckIn),
      lastUpdateTime: toIso(session.lastUpdateTime),
    };
  }

  private deserializeTrackedSession(payload: unknown): TrackedSession | null {
    if (!payload || typeof payload !== "object") return null;
    const obj = payload as Record<string, unknown>;

    const parseDate = (v: unknown): Date | undefined => {
      if (!v) return undefined;
      if (v instanceof Date) return v;
      if (typeof v === "string") {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? undefined : d;
      }
      return undefined;
    };

    const startTime = parseDate(obj.startTime);
    if (!startTime) return null;

    return {
      ...(obj as unknown as TrackedSession),
      startTime,
      lastActivityDate: parseDate(obj.lastActivityDate),
      lastPlaybackCheckIn: parseDate(obj.lastPlaybackCheckIn),
      lastUpdateTime: parseDate(obj.lastUpdateTime) ?? startTime,
    };
  }

  private async persistActiveSessions(
    serverId: number,
    sessionsMap: Map<string, TrackedSession>
  ): Promise<void> {
    const now = new Date();
    const rows: NewActiveSession[] = Array.from(sessionsMap.values()).map((s) => ({
      serverId,
      sessionKey: s.sessionKey,
      payload: this.serializeTrackedSession(s),
      lastSeenAt: now,
      updatedAt: now,
    }));

    await db.transaction(async (tx) => {
      await tx.execute(setLocalStatementTimeoutSql(DB_STATEMENT_TIMEOUT_MS));

      if (rows.length > 0) {
        await tx
          .insert(activeSessions)
          .values(rows)
          .onConflictDoUpdate({
            target: [activeSessions.serverId, activeSessions.sessionKey],
            set: {
              payload: sql`excluded.payload`,
              lastSeenAt: sql`excluded.last_seen_at`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }

      const keys = rows.map((r) => r.sessionKey);
      if (keys.length === 0) {
        await tx.delete(activeSessions).where(eq(activeSessions.serverId, serverId));
      } else {
        await tx
          .delete(activeSessions)
          .where(
            and(eq(activeSessions.serverId, serverId), notInArray(activeSessions.sessionKey, keys))
          );
      }
    });
  }

  private async loadPersistedState(): Promise<void> {
    try {
      const { active, cursors } = await db.transaction(async (tx) => {
        await tx.execute(setLocalStatementTimeoutSql(DB_STATEMENT_TIMEOUT_MS));
        const active = await tx.select().from(activeSessions);
        const cursors = await tx.select().from(activityLogCursors);
        return { active, cursors };
      });

      for (const row of active) {
        const serverKey = `server_${row.serverId}`;
        const map =
          this.trackedSessions.get(serverKey) ?? new Map<string, TrackedSession>();
        const tracked = this.deserializeTrackedSession(row.payload);
        if (!tracked) continue;
        map.set(row.sessionKey, tracked);
        this.trackedSessions.set(serverKey, map);
      }

      for (const row of cursors) {
        this.activityCursorByServerId.set(row.serverId, {
          cursorDate: row.cursorDate ?? null,
          cursorId: row.cursorId ?? null,
        });
      }

      if (active.length > 0) {
        log("session-poller", {
          action: "loaded-active-sessions",
          count: active.length,
          servers: new Set(active.map((r) => r.serverId)).size,
        });
      }
    } catch (error) {
      console.error(
        `[session-poller] action=load-persisted-state-error error=${formatError(error)}`
      );
    }
  }

  private async flushSessions(): Promise<void> {
    try {
      // If a poll is still running, give it a short window to unwind.
      const start = Date.now();
      while (this.pollInProgress && Date.now() - start < 15_000) {
        await new Promise((r) => setTimeout(r, 50));
      }

      const serversList = await this.listServers();
      const byId = new Map<number, Server>();
      for (const s of serversList) byId.set(s.id, s);

      const flushConcurrency = 5;
      const limit = pLimit(flushConcurrency);
      const tasks: Array<Promise<unknown>> = [];

      for (const [serverKey, sessionsMap] of this.trackedSessions.entries()) {
        const id = Number(serverKey.replace("server_", ""));
        const server = byId.get(id);
        if (!server) continue;

        for (const session of sessionsMap.values()) {
          let finalDuration = session.playDuration;
          if (!session.isPaused) {
            const timeDiff = Math.floor(
              (Date.now() - session.lastUpdateTime.getTime()) / 1000
            );
            finalDuration += timeDiff;
          }

          const percentComplete =
            session.runtimeTicks > 0
              ? (session.positionTicks / session.runtimeTicks) * 100
              : 0.0;
          const completed = percentComplete > 90.0;

          tasks.push(
            limit(() =>
              this.savePlaybackRecord(
                server,
                session,
                finalDuration,
                percentComplete,
                completed
              )
            )
          );
        }
      }

      await Promise.allSettled(tasks);

      await db.transaction(async (tx) => {
        await tx.execute(setLocalStatementTimeoutSql(DB_STATEMENT_TIMEOUT_MS));
        await tx.delete(activeSessions);
      });
      this.trackedSessions.clear();
    } catch (error) {
      console.error(`[session-poller] action=flush-error error=${formatError(error)}`);
    }
  }

  private async catchUpActivityLog(
    server: Server,
    client: JellyfinClient,
    signal: AbortSignal
  ): Promise<void> {
    try {
      const existing =
        this.activityCursorByServerId.get(server.id) ??
        ({ cursorDate: null, cursorId: null } as const);

      // First-run initialization: avoid backfilling the entire server history.
      if (!existing.cursorDate && !existing.cursorId) {
        // Keep a small lookback window so we still catch very recent events on first run.
        const initDate = new Date(Date.now() - 10 * 60_000);
        this.activityCursorByServerId.set(server.id, {
          cursorDate: initDate,
          cursorId: null,
        });
        await this.persistActivityLogCursor(server.id, initDate, null);
        return;
      }

      const limit = DEFAULT_ACTIVITY_LOG_LIMIT;
      const requestTimeoutMs = Math.max(1000, this.config.serverRequestTimeoutMs);

      const cursorDate = existing.cursorDate ?? new Date(0);
      const cursorId = existing.cursorId ?? null;

      const candidates: Array<{ a: JellyfinActivity; date: Date }> = [];

      // NOTE: Jellyfin returns newest-first; we page until we reach the cursor to avoid gaps.
      let startIndex = 0;
      let reachedCursor = false;
      let pagesFetched = 0;
      const maxPages = 50;

      while (!reachedCursor && pagesFetched < maxPages) {
        const page = await client.getActivities(startIndex, limit, {
          timeoutMs: requestTimeoutMs,
          retries: 0,
          signal,
        });
        if (page.length === 0) break;

        for (const a of page) {
          if (cursorId && a.Id === cursorId) {
            reachedCursor = true;
            break;
          }

          const d = new Date(a.Date);
          if (!Number.isFinite(d.getTime())) continue;

          if (d <= cursorDate) {
            reachedCursor = true;
            break;
          }

          candidates.push({ a, date: d });
        }

        if (page.length < limit) break;
        startIndex += page.length;
        pagesFetched += 1;
      }

      if (candidates.length === 0) return;

      candidates.sort((x, y) => x.date.getTime() - y.date.getTime());

      // Validate user ids in one batch (FK constraint on activities.userId)
      const userIdSet = new Set<string>();
      for (const c of candidates) {
        const uid = c.a.UserId;
        if (typeof uid === "string" && uid.length > 0) userIdSet.add(uid);
      }
      const userIds = Array.from(userIdSet);
      const validUserIds = new Set<string>();
      if (userIds.length > 0) {
        const rows = await db
          .select({ id: users.id })
          .from(users)
          .where(inArray(users.id, userIds));
        for (const row of rows) validUserIds.add(row.id);
      }

      const activityRows: NewActivity[] = [];
      for (const c of candidates) {
        const a = c.a;
        activityRows.push({
          id: a.Id,
          name: a.Name,
          shortOverview: a.ShortOverview || null,
          type: a.Type,
          date: c.date,
          severity: a.Severity,
          serverId: server.id,
          userId: a.UserId && validUserIds.has(a.UserId) ? a.UserId : null,
          itemId: a.ItemId || null,
        });
      }

      await db.transaction(async (tx) => {
        await tx.execute(setLocalStatementTimeoutSql(DB_STATEMENT_TIMEOUT_MS));
        await tx
          .insert(activities)
          .values(activityRows)
          .onConflictDoUpdate({
            target: activities.id,
            set: {
              name: sql`excluded.name`,
              shortOverview: sql`excluded.short_overview`,
              type: sql`excluded.type`,
              date: sql`excluded.date`,
              severity: sql`excluded.severity`,
              serverId: sql`excluded.server_id`,
              userId: sql`excluded.user_id`,
              itemId: sql`excluded.item_id`,
            },
          });
      });

      const last = candidates[candidates.length - 1]!;
      this.activityCursorByServerId.set(server.id, {
        cursorDate: last.date,
        cursorId: last.a.Id,
      });
      await this.persistActivityLogCursor(server.id, last.date, last.a.Id);
    } catch (error) {
      const signature = formatError(error);
      const key = `session-poller:activity-catchup-error:${server.id}`;
      if (shouldLog(key, 60_000)) {
        console.error(
          `[session-poller] action=activity-catchup-error serverId=${server.id} error=${signature}`
        );
      }
    }
  }

  private async persistActivityLogCursor(
    serverId: number,
    cursorDate: Date | null,
    cursorId: string | null
  ): Promise<void> {
    const now = new Date();
    const row: NewActivityLogCursor = {
      serverId,
      cursorDate,
      cursorId,
      updatedAt: now,
    };

    await db.transaction(async (tx) => {
      await tx.execute(setLocalStatementTimeoutSql(DB_STATEMENT_TIMEOUT_MS));
      await tx
        .insert(activityLogCursors)
        .values(row)
        .onConflictDoUpdate({
          target: activityLogCursors.serverId,
          set: {
            cursorDate,
            cursorId,
            updatedAt: now,
          },
        });
    });
  }

  /**
   * Filter out invalid sessions (trailers, prerolls, etc.)
   */
  private filterValidSessions(sessions: JellyfinSession[]): JellyfinSession[] {
    return sessions.filter((session) => {
      const item = session.NowPlayingItem;
      if (!item) return false;

      const itemType = item.Type;
      const providerIds = item.ProviderIds || {};

      return (
        itemType !== "Trailer" && !providerIds.hasOwnProperty("prerolls.video")
      );
    });
  }

  /**
   * Detect changes between current and tracked sessions
   */
  private detectSessionChanges(
    currentSessions: JellyfinSession[],
    trackedSessions: Map<string, TrackedSession>
  ): SessionChanges {
    const currentMap = new Map<string, JellyfinSession>();
    const newSessions: JellyfinSession[] = [];
    const updatedSessions: JellyfinSession[] = [];

    for (const session of currentSessions) {
      const key = this.generateSessionKey(session);
      currentMap.set(key, session);
      if (trackedSessions.has(key)) updatedSessions.push(session);
      else newSessions.push(session);
    }

    const endedSessions: Array<{ key: string; session: TrackedSession }> = [];
    for (const [key, session] of trackedSessions.entries()) {
      if (!currentMap.has(key)) endedSessions.push({ key, session });
    }

    return { newSessions, updatedSessions, endedSessions };
  }

  /**
   * Generate a unique session key
   */
  private generateSessionKey(session: JellyfinSession): string {
    // prefer session.Id; fallback to composite if missing
    const sid = session.Id ?? "";
    if (sid) return `sid:${sid}`;

    const userId = session.UserId || "";
    const deviceId = session.DeviceId || "";
    const item = session.NowPlayingItem;
    const itemId = item?.Id || "";
    const seriesId = item?.SeriesId || "";

    return `${userId}|${deviceId}|${seriesId}|${itemId}`;
  }

  /**
   * Handle new sessions
   */
  private async handleNewSessions(
    server: Server,
    newSessions: JellyfinSession[]
  ): Promise<Map<string, TrackedSession>> {
    const now = new Date();
    const tracked = new Map<string, TrackedSession>();

    for (const session of newSessions) {
      const sessionKey = this.generateSessionKey(session);
      const item = session.NowPlayingItem!;
      const playState = session.PlayState || {};
      const transcodingInfo = session.TranscodingInfo;

      const isPaused = playState.IsPaused || false;
      const lastActivity = this.parseJellyfinDate(session.LastActivityDate);

      const trackingRecord: TrackedSession = {
        sessionKey,
        userJellyfinId: session.UserId || "",
        userName: session.UserName || "",
        clientName: session.Client,
        deviceId: session.DeviceId,
        deviceName: session.DeviceName,
        itemId: item.Id,
        itemName: item.Name,
        seriesId: item.SeriesId,
        seriesName: item.SeriesName,
        seasonId: item.SeasonId,
        positionTicks: playState.PositionTicks || 0,
        runtimeTicks: item.RunTimeTicks || 0,
        playDuration: 0,
        startTime: now,
        lastActivityDate: lastActivity,
        lastPlaybackCheckIn: this.parseJellyfinDate(
          session.LastPlaybackCheckIn
        ),
        lastUpdateTime: now,
        isPaused,
        playMethod: playState.PlayMethod,

        // PlayState fields
        isMuted: playState.IsMuted,
        volumeLevel: playState.VolumeLevel,
        audioStreamIndex: playState.AudioStreamIndex,
        subtitleStreamIndex: playState.SubtitleStreamIndex,
        mediaSourceId: playState.MediaSourceId,
        repeatMode: playState.RepeatMode,
        playbackOrder: playState.PlaybackOrder,

        // Session fields
        remoteEndPoint: session.RemoteEndPoint,
        sessionId: session.Id,
        applicationVersion: session.ApplicationVersion,
        isActive: session.IsActive,

        // TranscodingInfo fields
        transcodingAudioCodec: transcodingInfo?.AudioCodec,
        transcodingVideoCodec: transcodingInfo?.VideoCodec,
        transcodingContainer: transcodingInfo?.Container,
        transcodingIsVideoDirect: transcodingInfo?.IsVideoDirect,
        transcodingIsAudioDirect: transcodingInfo?.IsAudioDirect,
        transcodingBitrate: transcodingInfo?.Bitrate,
        transcodingCompletionPercentage: transcodingInfo?.CompletionPercentage,
        transcodingWidth: transcodingInfo?.Width,
        transcodingHeight: transcodingInfo?.Height,
        transcodingAudioChannels: transcodingInfo?.AudioChannels,
        transcodingHardwareAccelerationType:
          transcodingInfo?.HardwareAccelerationType,
        transcodeReasons: transcodingInfo?.TranscodeReasons,
      };

      log("session", {
        action: "new",
        serverId: server.id,
        user: session.UserName,
        content: item.Name,
        paused: isPaused,
        durationSec: 0,
      });

      tracked.set(sessionKey, trackingRecord);
    }

    return tracked;
  }

  /**
   * Handle updated sessions
   */
  private async handleUpdatedSessions(
    server: Server,
    updatedSessions: JellyfinSession[],
    trackedSessions: Map<string, TrackedSession>
  ): Promise<Map<string, TrackedSession>> {
    const now = new Date();

    for (const session of updatedSessions) {
      const sessionKey = this.generateSessionKey(session);
      const tracked = trackedSessions.get(sessionKey);
      if (!tracked) continue;

      const playState = session.PlayState || {};
      const currentPaused = playState.IsPaused || false;
      const currentPosition = playState.PositionTicks || 0;
      const lastActivity = this.parseJellyfinDate(session.LastActivityDate);
      const lastPaused = this.parseJellyfinDate(session.LastPausedDate);

      const updatedDuration = this.calculateDuration(
        tracked,
        currentPaused,
        lastActivity,
        lastPaused,
        currentPosition
      );

      const pauseStateChanged = currentPaused !== tracked.isPaused;
      const durationIncreased = updatedDuration > tracked.playDuration + 10;

      if (pauseStateChanged || durationIncreased) {
        log("session", {
          action: "update",
          serverId: server.id,
          user: tracked.userName,
          content: tracked.itemName,
          paused: currentPaused,
          durationSec: updatedDuration,
          position: this.formatTicksAsTime(currentPosition),
        });
      }

      const transcodingInfo = session.TranscodingInfo;

      // Update the tracked session
      const updatedRecord: TrackedSession = {
        ...tracked,
        positionTicks: currentPosition,
        isPaused: currentPaused,
        lastActivityDate: lastActivity,
        lastUpdateTime: now,
        playDuration: updatedDuration,
        applicationVersion:
          session.ApplicationVersion || tracked.applicationVersion,
        isActive: session.IsActive ?? tracked.isActive,
        remoteEndPoint: session.RemoteEndPoint || tracked.remoteEndPoint,
        lastPlaybackCheckIn:
          this.parseJellyfinDate(session.LastPlaybackCheckIn) ||
          tracked.lastPlaybackCheckIn,

        // Update PlayState fields
        isMuted: playState.IsMuted ?? tracked.isMuted,
        volumeLevel: playState.VolumeLevel ?? tracked.volumeLevel,
        audioStreamIndex:
          playState.AudioStreamIndex ?? tracked.audioStreamIndex,
        subtitleStreamIndex:
          playState.SubtitleStreamIndex ?? tracked.subtitleStreamIndex,
        mediaSourceId: playState.MediaSourceId ?? tracked.mediaSourceId,
        repeatMode: playState.RepeatMode ?? tracked.repeatMode,
        playbackOrder: playState.PlaybackOrder ?? tracked.playbackOrder,
        playMethod: playState.PlayMethod ?? tracked.playMethod,

        // Update TranscodingInfo fields
        transcodingAudioCodec:
          transcodingInfo?.AudioCodec ?? tracked.transcodingAudioCodec,
        transcodingVideoCodec:
          transcodingInfo?.VideoCodec ?? tracked.transcodingVideoCodec,
        transcodingContainer:
          transcodingInfo?.Container ?? tracked.transcodingContainer,
        transcodingIsVideoDirect:
          transcodingInfo?.IsVideoDirect ?? tracked.transcodingIsVideoDirect,
        transcodingIsAudioDirect:
          transcodingInfo?.IsAudioDirect ?? tracked.transcodingIsAudioDirect,
        transcodingBitrate:
          transcodingInfo?.Bitrate ?? tracked.transcodingBitrate,
        transcodingCompletionPercentage:
          transcodingInfo?.CompletionPercentage ??
          tracked.transcodingCompletionPercentage,
        transcodingWidth: transcodingInfo?.Width ?? tracked.transcodingWidth,
        transcodingHeight: transcodingInfo?.Height ?? tracked.transcodingHeight,
        transcodingAudioChannels:
          transcodingInfo?.AudioChannels ?? tracked.transcodingAudioChannels,
        transcodingHardwareAccelerationType:
          transcodingInfo?.HardwareAccelerationType ??
          tracked.transcodingHardwareAccelerationType,
        transcodeReasons:
          transcodingInfo?.TranscodeReasons ?? tracked.transcodeReasons,
      };

      trackedSessions.set(sessionKey, updatedRecord);
    }

    return trackedSessions;
  }

  /**
   * Handle ended sessions
   */
  private async handleEndedSessions(
    server: Server,
    endedSessions: Array<{ key: string; session: TrackedSession }>,
    trackedSessions: Map<string, TrackedSession>
  ): Promise<Map<string, TrackedSession>> {
    const now = new Date();

    for (const { key, session: tracked } of endedSessions) {
      let finalDuration = tracked.playDuration;

      if (!tracked.isPaused) {
        const timeDiff = Math.floor(
          (now.getTime() - tracked.lastUpdateTime.getTime()) / 1000
        );
        finalDuration += timeDiff;
      }

      if (finalDuration > 1) {
        const percentComplete =
          tracked.runtimeTicks > 0
            ? (tracked.positionTicks / tracked.runtimeTicks) * 100
            : 0.0;

        const completed = percentComplete > 90.0;

        log("session", {
          action: "ended",
          serverId: server.id,
          user: tracked.userName,
          content: tracked.itemName,
          durationSec: finalDuration,
          progressPct: Math.round(percentComplete * 10) / 10,
          completed,
        });

        await this.savePlaybackRecord(
          server,
          tracked,
          finalDuration,
          percentComplete,
          completed
        );
      }

      trackedSessions.delete(key);
    }

    return trackedSessions;
  }

  /**
   * Calculate play duration based on session state
   */
  private calculateDuration(
    tracked: TrackedSession,
    currentPaused: boolean,
    lastActivity?: Date,
    lastPaused?: Date,
    currentPosition?: number
  ): number {
    const wasPaused = tracked.isPaused;

    if (wasPaused === false && currentPaused === true && lastPaused) {
      return (
        tracked.playDuration +
        Math.floor(
          (lastPaused.getTime() - tracked.lastUpdateTime.getTime()) / 1000
        )
      );
    }

    if (wasPaused === false && currentPaused === false && lastActivity) {
      return (
        tracked.playDuration +
        Math.floor(
          (lastActivity.getTime() - tracked.lastUpdateTime.getTime()) / 1000
        )
      );
    }

    if (wasPaused === true && currentPaused === false) {
      return tracked.playDuration;
    }

    return tracked.playDuration;
  }

  /**
   * Save playback record to database
   */
  private async savePlaybackRecord(
    server: Server,
    tracked: TrackedSession,
    finalDuration: number,
    percentComplete: number,
    completed: boolean
  ): Promise<void> {
    try {
      // Use a transaction with statement_timeout so DB stalls can't wedge polling.
      await db.transaction(async (tx) => {
        await tx.execute(setLocalStatementTimeoutSql(DB_STATEMENT_TIMEOUT_MS));

        // Get user from database using jellyfin ID
        const user = await tx
          .select()
          .from(users)
          .where(eq(users.id, tracked.userJellyfinId))
          .limit(1);

        const stableId = tracked.sessionId
          ? `sid:${server.id}:${tracked.sessionId}`
          : `trk:${server.id}:${tracked.sessionKey}:${tracked.startTime.toISOString()}`;

        const playbackRecord: NewSession = {
          id: stableId,
          serverId: server.id,
          userId: user.length > 0 ? user[0].id : null,
          itemId: tracked.itemId,
          userName: tracked.userName,
          userServerId: tracked.userJellyfinId,
          deviceId: tracked.deviceId,
          deviceName: tracked.deviceName,
          clientName: tracked.clientName,
          applicationVersion: tracked.applicationVersion,
          remoteEndPoint: tracked.remoteEndPoint,
          itemName: tracked.itemName,
          seriesId: tracked.seriesId,
          seriesName: tracked.seriesName,
          seasonId: tracked.seasonId,
          playDuration: finalDuration,
          startTime: tracked.startTime,
          endTime: new Date(),
          lastActivityDate: tracked.lastActivityDate,
          lastPlaybackCheckIn: tracked.lastPlaybackCheckIn,
          runtimeTicks: tracked.runtimeTicks,
          positionTicks: tracked.positionTicks,
          percentComplete,
          completed,
          isPaused: tracked.isPaused,
          isMuted: tracked.isMuted || false,
          isActive: tracked.isActive || false,
          volumeLevel: tracked.volumeLevel,
          audioStreamIndex: tracked.audioStreamIndex,
          subtitleStreamIndex: tracked.subtitleStreamIndex,
          playMethod: tracked.playMethod,
          isTranscoded:
            tracked.playMethod !== "DirectPlay" &&
            tracked.playMethod !== "DirectStream",
          mediaSourceId: tracked.mediaSourceId,
          repeatMode: tracked.repeatMode,
          playbackOrder: tracked.playbackOrder,
          transcodingAudioCodec: tracked.transcodingAudioCodec,
          transcodingVideoCodec: tracked.transcodingVideoCodec,
          transcodingContainer: tracked.transcodingContainer,
          transcodingIsVideoDirect: tracked.transcodingIsVideoDirect,
          transcodingIsAudioDirect: tracked.transcodingIsAudioDirect,
          transcodingBitrate: tracked.transcodingBitrate,
          transcodingCompletionPercentage:
            tracked.transcodingCompletionPercentage,
          transcodingWidth: tracked.transcodingWidth,
          transcodingHeight: tracked.transcodingHeight,
          transcodingAudioChannels: tracked.transcodingAudioChannels,
          transcodingHardwareAccelerationType:
            tracked.transcodingHardwareAccelerationType,
          transcodeReasons: tracked.transcodeReasons,
          rawData: {
            sessionKey: tracked.sessionKey,
            transcodeReasons: tracked.transcodeReasons,
          },
        };

        await tx.insert(sessions).values(playbackRecord).onConflictDoNothing();
      });
      log("session", {
        action: "saved",
        serverId: server.id,
        user: tracked.userName,
      });
    } catch (error) {
      console.error(
        `[session] action=save-error serverId=${server.id} error=${formatError(
          error
        )}`
      );
    }
  }

  /**
   * Parse Jellyfin date string to Date object
   */
  private parseJellyfinDate(dateStr?: string): Date | undefined {
    if (!dateStr) return undefined;

    try {
      return new Date(dateStr);
    } catch {
      return undefined;
    }
  }

  /**
   * Format ticks as time string
   */
  private formatTicksAsTime(ticks?: number): string {
    if (!ticks || ticks <= 0) return "00:00:00";

    const totalSeconds = Math.floor(ticks / 10_000_000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${this.padTime(hours)}:${this.padTime(minutes)}:${this.padTime(
      seconds
    )}`;
  }

  /**
   * Pad time component with leading zero
   */
  private padTime(time: number): string {
    return time.toString().padStart(2, "0");
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<SessionPollerConfig>): void {
    Object.assign(this.config, config);

    if (config.intervalMs && this.timerId) {
      // Restart with new interval
      void this.stop().then(() => this.start());
    }
  }

  /**
   * Get poller status
   */
  getStatus() {
    const now = Date.now();
    return {
      enabled: this.config.enabled,
      intervalMs: this.config.intervalMs,
      pollTimeoutMs: this.config.pollTimeoutMs,
      serverRequestTimeoutMs: this.config.serverRequestTimeoutMs,
      serverConcurrency: this.config.serverConcurrency,
      isRunning: this.timerId !== null && !this.stopRequested,
      pollInProgress: this.pollInProgress,
      trackedServers: this.trackedSessions.size,
      totalTrackedSessions: this.countTrackedSessions(),
      // Health metrics
      totalPollCount: this.totalPollCount,
      totalSuccessCount: this.totalSuccessCount,
      totalTimeoutCount: this.totalTimeoutCount,
      successRate: this.totalPollCount > 0
        ? Math.round((this.totalSuccessCount / this.totalPollCount) * 100)
        : 100,
      consecutiveFailures: this.consecutiveFailures,
      lastTimeoutAgoMs: this.lastTimeoutAtMs ? now - this.lastTimeoutAtMs : null,
      lastCycleDurationMs: this.lastCycleDurationMs,
      lastSuccessfulPollAgoMs: this.lastSuccessfulPoll > 0
        ? now - this.lastSuccessfulPoll
        : null,
      serversInBackoff: this.serverBackoff.size,
      // Health status
      healthy:
        this.timerId !== null &&
        this.consecutiveFailures < 10 &&
        (this.lastSuccessfulPoll === 0 ||
          now - this.lastSuccessfulPoll < 5 * 60_000),
    };
  }
}

// Export singleton instance
export const sessionPoller = new SessionPoller();

export { SessionPoller, SessionPollerConfig };
