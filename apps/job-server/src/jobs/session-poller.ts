import {
  db,
  activeSessions,
  items,
  mediaSources,
  servers,
  sessions,
  users,
  serverJobConfigurations,
  type NewActiveSession,
  type NewSession,
  type Server,
} from "@streamystats/database";
import { JellyfinClient } from "../jellyfin/client";
import {
  JellyfinSession,
  TrackedSession,
  ActiveSessionResponse,
} from "../jellyfin/types";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { formatError } from "../utils/format-error";
import { structuredLog as log } from "../utils/structured-log";
import {
  resolveSessionItemId,
  type ResolvedSessionItem,
  type SessionItemLookups,
} from "./session-item-resolver";

// ============================================================================
// Configuration (hardcoded - no per-server customization for interval)
// ============================================================================
const POLL_INTERVAL_MS = 5000; // Hardcoded 5 seconds
const JELLYFIN_TIMEOUT_MS = 60_000; // 60s timeout for slow Jellyfin servers
const JELLYFIN_RETRIES = 3;
const DB_STATEMENT_TIMEOUT_MS = 10_000;

function setLocalStatementTimeoutSql(ms: number) {
  const safeMs = Math.max(0, Math.floor(ms));
  return sql.raw(`SET LOCAL statement_timeout = ${safeMs}`);
}

// ============================================================================
// Types
// ============================================================================
interface SessionChanges {
  newSessions: JellyfinSession[];
  updatedSessions: JellyfinSession[];
  endedSessions: Array<{ key: string; session: TrackedSession }>;
}

// ============================================================================
// Session Poller Class
// ============================================================================
class SessionPoller {
  private trackedSessions: Map<string, Map<string, TrackedSession>> = new Map();
  private timerId: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;
  private lastPollAt: number | null = null;
  private totalPollCount = 0;
  private totalSuccessCount = 0;

  // ============================================================================
  // Public API
  // ============================================================================

  async start(): Promise<void> {
    if (this.isRunning) {
      log("session-poller", { action: "already-running" });
      return;
    }

    log("session-poller", {
      action: "starting",
      intervalMs: POLL_INTERVAL_MS,
      jellyfinTimeoutMs: JELLYFIN_TIMEOUT_MS,
      jellyfinRetries: JELLYFIN_RETRIES,
    });

    await this.loadPersistedState();
    this.isRunning = true;

    // Initial tick
    await this.tick();

    // Start interval
    this.timerId = setInterval(() => {
      void this.tick().catch((err) => {
        log("session-poller", { action: "tick-error", error: formatError(err) });
      });
    }, POLL_INTERVAL_MS);

    log("session-poller", { action: "started" });
  }

  async stop(): Promise<void> {
    log("session-poller", { action: "stopping" });

    this.isRunning = false;

    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    await this.flushSessions();
    log("session-poller", { action: "stopped" });
  }

  getStatus() {
    const now = Date.now();
    return {
      enabled: true, // Always enabled (hardcoded)
      isRunning: this.isRunning,
      intervalMs: POLL_INTERVAL_MS,
      trackedServers: this.trackedSessions.size,
      totalTrackedSessions: this.countTrackedSessions(),
      totalPollCount: this.totalPollCount,
      totalSuccessCount: this.totalSuccessCount,
      successRate:
        this.totalPollCount > 0
          ? Math.round((this.totalSuccessCount / this.totalPollCount) * 100)
          : 100,
      lastPollAgoMs: this.lastPollAt ? now - this.lastPollAt : null,
      healthy: this.isRunning,
    };
  }

  getActiveSessions(serverId: number): ActiveSessionResponse[] {
    const serverKey = `server_${serverId}`;
    const tracked = this.trackedSessions.get(serverKey) || new Map();

    return Array.from(tracked.values()).map((session) => ({
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

  async reloadServerConfig(serverId: number): Promise<void> {
    // Only enable/disable is configurable now, no interval changes
    log("session-poller", { action: "config-reloaded", serverId });
  }

  // ============================================================================
  // Core Loop
  // ============================================================================

  private async tick(): Promise<void> {
    this.totalPollCount++;
    const tickStart = Date.now();

    try {
      const allServers = await this.listServers();

      for (const server of allServers) {
        if (!(await this.isServerPollingEnabled(server.id))) continue;

        try {
          await this.pollServer(server);
        } catch (err) {
          log("session-poller", { action: "server-error", serverId: server.id, error: formatError(err) });
          // Continue to next server - will retry in 5s
        }
      }

      this.lastPollAt = Date.now();
      this.totalSuccessCount++;
    } catch (err) {
      log("session-poller", { action: "tick-failed", error: formatError(err) });
    }

    const tickDuration = Date.now() - tickStart;
    if (tickDuration > 2000) {
      log("session-poller", { action: "slow-tick", durationMs: tickDuration });
    }
  }

  private async pollServer(server: Server): Promise<void> {
    const client = JellyfinClient.fromServer(server);
    const currentSessions = await client.getSessions({
      timeoutMs: JELLYFIN_TIMEOUT_MS,
      retries: JELLYFIN_RETRIES,
    });

    await this.processSessions(server, currentSessions);
  }

  // ============================================================================
  // Session Lifecycle
  // ============================================================================

  private async processSessions(
    server: Server,
    currentSessions: JellyfinSession[]
  ): Promise<void> {
    const serverKey = `server_${server.id}`;
    const trackedSessions = this.trackedSessions.get(serverKey) || new Map();

    const filteredSessions = this.filterValidSessions(currentSessions);
    const changes = this.detectSessionChanges(filteredSessions, trackedSessions);

    // Handle new sessions
    const newTracked = await this.handleNewSessions(server, changes.newSessions);
    const mergedSessions = new Map([...trackedSessions, ...newTracked]);

    // Handle updated sessions
    const updatedSessions = await this.handleUpdatedSessions(
      server,
      changes.updatedSessions,
      mergedSessions
    );

    // Handle ended sessions
    const finalSessions = await this.handleEndedSessions(
      server,
      changes.endedSessions,
      updatedSessions
    );

    this.trackedSessions.set(serverKey, finalSessions);

    // Persist active sessions
    try {
      await this.persistActiveSessions(server.id, finalSessions);
    } catch (err) {
      log("session-poller", { action: "persist-error", serverId: server.id, error: formatError(err) });
    }
  }

  private async handleNewSessions(
    server: Server,
    newSessions: JellyfinSession[]
  ): Promise<Map<string, TrackedSession>> {
    const now = new Date();
    const tracked = new Map<string, TrackedSession>();

    for (const session of newSessions) {
      const sessionKey = this.generateSessionKey(session);
      const item = session.NowPlayingItem;
      if (!item) continue; // Filtered upstream, but safety check
      const playState = session.PlayState || {};
      const transcodingInfo = session.TranscodingInfo;
      const isPaused = playState.IsPaused || false;
      const resolvedItem = await this.resolveNowPlayingItem(server, session);

      const record: TrackedSession = {
        sessionKey,
        userJellyfinId: session.UserId || "",
        userName: session.UserName || "",
        clientName: session.Client,
        deviceId: session.DeviceId,
        deviceName: session.DeviceName,
        itemId: resolvedItem.itemId,
        jellyfinItemId: item.Id,
        itemName: item.Name,
        seriesId: item.SeriesId,
        seriesName: item.SeriesName,
        seasonId: item.SeasonId,
        positionTicks: playState.PositionTicks || 0,
        runtimeTicks: item.RunTimeTicks || 0,
        playDuration: 0,
        startTime: now,
        lastActivityDate: this.parseDate(session.LastActivityDate),
        lastPlaybackCheckIn: this.parseDate(session.LastPlaybackCheckIn),
        lastUpdateTime: now,
        isPaused,
        playMethod: playState.PlayMethod,
        isMuted: playState.IsMuted,
        volumeLevel: playState.VolumeLevel,
        audioStreamIndex: playState.AudioStreamIndex,
        subtitleStreamIndex: playState.SubtitleStreamIndex,
        mediaSourceId: playState.MediaSourceId,
        repeatMode: playState.RepeatMode,
        playbackOrder: playState.PlaybackOrder,
        remoteEndPoint: session.RemoteEndPoint,
        sessionId: session.Id,
        applicationVersion: session.ApplicationVersion,
        isActive: session.IsActive,
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
        transcodingHardwareAccelerationType: transcodingInfo?.HardwareAccelerationType,
        transcodeReasons: transcodingInfo?.TranscodeReasons,
      };

      log("session", {
        action: "new",
        serverId: server.id,
        user: session.UserName,
        content: item.Name,
        paused: isPaused,
      });

      tracked.set(sessionKey, record);
    }

    return tracked;
  }

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

      const item = session.NowPlayingItem;
      const playState = session.PlayState || {};
      const currentItemId = item?.Id || "";
      const currentPosition = playState.PositionTicks || 0;

      // Detect item change or position reset (new playback). Compare against the id
      // Jellyfin reports, which differs from the stored item for alternate versions.
      const itemChanged = currentItemId !== (tracked.jellyfinItemId ?? tracked.itemId);
      const positionReset =
        tracked.positionTicks > 600_000_000 &&
        currentPosition < 100_000_000 &&
        tracked.playDuration > 30;

      if (itemChanged || positionReset) {
        // End current session
        const finalDuration = this.getFinalDuration(tracked, now);

        if (finalDuration > 1) {
          const percentComplete = this.getPercentComplete(tracked);
          await this.savePlaybackRecord(
            server,
            tracked,
            finalDuration,
            percentComplete,
            percentComplete > 90
          );
        }

        // Start new tracking
        const newTracked = await this.createTrackedSession(server, session, now);
        if (!newTracked) continue;
        log("session", {
          action: "new",
          reason: itemChanged ? "item-changed" : "position-reset",
          serverId: server.id,
          user: newTracked.userName,
          content: newTracked.itemName,
        });
        trackedSessions.set(sessionKey, newTracked);
        continue;
      }

      // Update existing session
      const currentPaused = playState.IsPaused || false;
      const updatedDuration = this.calculateDuration(tracked, currentPaused);
      const transcodingInfo = session.TranscodingInfo;

      // Log pause/resume when state changes
      if (currentPaused !== tracked.isPaused) {
        log("session", {
          action: currentPaused ? "paused" : "resumed",
          serverId: server.id,
          user: tracked.userName,
          content: tracked.itemName,
          durationSec: updatedDuration,
        });
      }

      const updatedRecord: TrackedSession = {
        ...tracked,
        positionTicks: currentPosition,
        isPaused: currentPaused,
        lastActivityDate: this.parseDate(session.LastActivityDate),
        lastUpdateTime: now,
        playDuration: updatedDuration,
        applicationVersion: session.ApplicationVersion || tracked.applicationVersion,
        isActive: session.IsActive ?? tracked.isActive,
        remoteEndPoint: session.RemoteEndPoint || tracked.remoteEndPoint,
        lastPlaybackCheckIn:
          this.parseDate(session.LastPlaybackCheckIn) || tracked.lastPlaybackCheckIn,
        isMuted: playState.IsMuted ?? tracked.isMuted,
        volumeLevel: playState.VolumeLevel ?? tracked.volumeLevel,
        audioStreamIndex: playState.AudioStreamIndex ?? tracked.audioStreamIndex,
        subtitleStreamIndex: playState.SubtitleStreamIndex ?? tracked.subtitleStreamIndex,
        mediaSourceId: playState.MediaSourceId ?? tracked.mediaSourceId,
        repeatMode: playState.RepeatMode ?? tracked.repeatMode,
        playbackOrder: playState.PlaybackOrder ?? tracked.playbackOrder,
        playMethod: playState.PlayMethod ?? tracked.playMethod,
        transcodingAudioCodec: transcodingInfo?.AudioCodec ?? tracked.transcodingAudioCodec,
        transcodingVideoCodec: transcodingInfo?.VideoCodec ?? tracked.transcodingVideoCodec,
        transcodingContainer: transcodingInfo?.Container ?? tracked.transcodingContainer,
        transcodingIsVideoDirect: transcodingInfo?.IsVideoDirect ?? tracked.transcodingIsVideoDirect,
        transcodingIsAudioDirect: transcodingInfo?.IsAudioDirect ?? tracked.transcodingIsAudioDirect,
        transcodingBitrate: transcodingInfo?.Bitrate ?? tracked.transcodingBitrate,
        transcodingCompletionPercentage:
          transcodingInfo?.CompletionPercentage ?? tracked.transcodingCompletionPercentage,
        transcodingWidth: transcodingInfo?.Width ?? tracked.transcodingWidth,
        transcodingHeight: transcodingInfo?.Height ?? tracked.transcodingHeight,
        transcodingAudioChannels: transcodingInfo?.AudioChannels ?? tracked.transcodingAudioChannels,
        transcodingHardwareAccelerationType:
          transcodingInfo?.HardwareAccelerationType ?? tracked.transcodingHardwareAccelerationType,
        transcodeReasons: transcodingInfo?.TranscodeReasons ?? tracked.transcodeReasons,
      };

      trackedSessions.set(sessionKey, updatedRecord);
    }

    return trackedSessions;
  }

  private async handleEndedSessions(
    server: Server,
    endedSessions: Array<{ key: string; session: TrackedSession }>,
    trackedSessions: Map<string, TrackedSession>
  ): Promise<Map<string, TrackedSession>> {
    const now = new Date();

    for (const { key, session: tracked } of endedSessions) {
      const finalDuration = this.getFinalDuration(tracked, now);

      if (finalDuration > 1) {
        const percentComplete = this.getPercentComplete(tracked);
        const completed = percentComplete > 90;

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

  private async createTrackedSession(
    server: Server,
    session: JellyfinSession,
    now: Date
  ): Promise<TrackedSession | null> {
    const item = session.NowPlayingItem;
    if (!item) return null; // Safety check
    const playState = session.PlayState || {};
    const transcodingInfo = session.TranscodingInfo;
    const resolvedItem = await this.resolveNowPlayingItem(server, session);

    return {
      sessionKey: this.generateSessionKey(session),
      userJellyfinId: session.UserId || "",
      userName: session.UserName || "",
      clientName: session.Client,
      deviceId: session.DeviceId,
      deviceName: session.DeviceName,
      itemId: resolvedItem.itemId,
      jellyfinItemId: item.Id,
      itemName: item.Name,
      seriesId: item.SeriesId,
      seriesName: item.SeriesName,
      seasonId: item.SeasonId,
      runtimeTicks: item.RunTimeTicks || 0,
      positionTicks: playState.PositionTicks || 0,
      isPaused: playState.IsPaused || false,
      startTime: now,
      lastUpdateTime: now,
      lastActivityDate: this.parseDate(session.LastActivityDate),
      lastPlaybackCheckIn: this.parseDate(session.LastPlaybackCheckIn),
      playDuration: 0,
      sessionId: session.Id,
      applicationVersion: session.ApplicationVersion,
      isActive: session.IsActive,
      remoteEndPoint: session.RemoteEndPoint,
      isMuted: playState.IsMuted,
      volumeLevel: playState.VolumeLevel,
      audioStreamIndex: playState.AudioStreamIndex,
      subtitleStreamIndex: playState.SubtitleStreamIndex,
      mediaSourceId: playState.MediaSourceId,
      repeatMode: playState.RepeatMode,
      playbackOrder: playState.PlaybackOrder,
      playMethod: playState.PlayMethod,
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
      transcodingHardwareAccelerationType: transcodingInfo?.HardwareAccelerationType,
      transcodeReasons: transcodingInfo?.TranscodeReasons,
    };
  }

  /**
   * Alternate versions (movies on every Jellyfin release, episodes since 12)
   * are hidden items whose ids never appear in library listings; map them to
   * the listed item so the playback record satisfies the items foreign key.
   */
  private async resolveNowPlayingItem(
    server: Server,
    session: JellyfinSession
  ): Promise<ResolvedSessionItem> {
    const item = session.NowPlayingItem;
    if (!item) return { itemId: "", resolvedVia: "unresolved" };

    const lookups: SessionItemLookups = {
      itemExists: async (itemId) => {
        const rows = await db
          .select({ id: items.id })
          .from(items)
          .where(and(eq(items.id, itemId), eq(items.serverId, server.id)))
          .limit(1);
        return rows.length > 0;
      },
      itemIdForMediaSource: async (mediaSourceId) => {
        const rows = await db
          .select({ itemId: mediaSources.itemId })
          .from(mediaSources)
          .where(
            and(eq(mediaSources.id, mediaSourceId), eq(mediaSources.serverId, server.id))
          )
          .limit(1);
        return rows[0]?.itemId ?? null;
      },
      fetchMediaSourceIds: async (itemId) => {
        try {
          const client = JellyfinClient.fromServer(server);
          return await client.getItemMediaSourceIds(itemId, session.UserId);
        } catch (err) {
          log("session", {
            action: "version-lookup-failed",
            serverId: server.id,
            itemId,
            error: formatError(err),
          });
          return [];
        }
      },
    };

    const resolved = await resolveSessionItemId({
      nowPlayingItemId: item.Id,
      mediaSourceId: session.PlayState?.MediaSourceId,
      lookups,
    });

    if (resolved.resolvedVia !== "item") {
      log("session", {
        action: resolved.resolvedVia === "unresolved" ? "item-unresolved" : "item-resolved",
        serverId: server.id,
        user: session.UserName,
        content: item.Name,
        nowPlayingItemId: item.Id,
        itemId: resolved.itemId,
        via: resolved.resolvedVia,
      });
    }

    return resolved;
  }

  // ============================================================================
  // Database Operations
  // ============================================================================

  private async savePlaybackRecord(
    server: Server,
    tracked: TrackedSession,
    finalDuration: number,
    percentComplete: number,
    completed: boolean
  ): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        await tx.execute(setLocalStatementTimeoutSql(DB_STATEMENT_TIMEOUT_MS));

        const user = await tx
          .select()
          .from(users)
          .where(eq(users.id, tracked.userJellyfinId))
          .limit(1);

        const stableId = tracked.sessionId
          ? `sid:${server.id}:${tracked.sessionId}:${tracked.startTime.toISOString()}`
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
          transcodingCompletionPercentage: tracked.transcodingCompletionPercentage,
          transcodingWidth: tracked.transcodingWidth,
          transcodingHeight: tracked.transcodingHeight,
          transcodingAudioChannels: tracked.transcodingAudioChannels,
          transcodingHardwareAccelerationType: tracked.transcodingHardwareAccelerationType,
          transcodeReasons: tracked.transcodeReasons,
          rawData: {
            sessionKey: tracked.sessionKey,
            transcodeReasons: tracked.transcodeReasons,
            nowPlayingItemId: tracked.jellyfinItemId ?? tracked.itemId,
          },
        };

        const result = await tx
          .insert(sessions)
          .values(playbackRecord)
          .onConflictDoNothing()
          .returning({ id: sessions.id });

        if (result.length > 0) {
          log("session", { action: "saved", serverId: server.id, user: tracked.userName });
        }
      });
    } catch (err) {
      // Log comprehensive error - NO RETRY
      log("session", {
        action: "save-error",
        serverId: server.id,
        sessionKey: tracked.sessionKey,
        user: tracked.userName,
        item: tracked.itemName,
        durationSec: finalDuration,
        error: formatError(err),
      });
    }
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
      const active = await db.transaction(async (tx) => {
        await tx.execute(setLocalStatementTimeoutSql(DB_STATEMENT_TIMEOUT_MS));
        return await tx.select().from(activeSessions);
      });

      for (const row of active) {
        const serverKey = `server_${row.serverId}`;
        const map = this.trackedSessions.get(serverKey) ?? new Map<string, TrackedSession>();
        const tracked = this.deserializeTrackedSession(row.payload);
        if (!tracked) continue;
        map.set(row.sessionKey, tracked);
        this.trackedSessions.set(serverKey, map);
      }

      if (active.length > 0) {
        log("session-poller", {
          action: "loaded-sessions",
          count: active.length,
          servers: new Set(active.map((r) => r.serverId)).size,
        });
      }
    } catch (err) {
      log("session-poller", { action: "load-state-error", error: formatError(err) });
    }
  }

  private async flushSessions(): Promise<void> {
    try {
      const serversList = await this.listServers();
      const byId = new Map<number, Server>();
      for (const s of serversList) byId.set(s.id, s);

      for (const [serverKey, sessionsMap] of this.trackedSessions.entries()) {
        const id = Number(serverKey.replace("server_", ""));
        const server = byId.get(id);
        if (!server) continue;

        for (const session of sessionsMap.values()) {
          const finalDuration = this.getFinalDuration(session, new Date());
          if (finalDuration <= 1) continue;

          const percentComplete = this.getPercentComplete(session);
          await this.savePlaybackRecord(
            server,
            session,
            finalDuration,
            percentComplete,
            percentComplete > 90
          );
        }
      }

      await db.transaction(async (tx) => {
        await tx.execute(setLocalStatementTimeoutSql(DB_STATEMENT_TIMEOUT_MS));
        await tx.delete(activeSessions);
      });
      this.trackedSessions.clear();
    } catch (err) {
      log("session-poller", { action: "flush-error", error: formatError(err) });
    }
  }

  private async listServers(): Promise<Server[]> {
    return await db.transaction(async (tx) => {
      await tx.execute(setLocalStatementTimeoutSql(DB_STATEMENT_TIMEOUT_MS));
      return await tx.select().from(servers);
    });
  }

  private async isServerPollingEnabled(serverId: number): Promise<boolean> {
    const configs = await db
      .select({ enabled: serverJobConfigurations.enabled })
      .from(serverJobConfigurations)
      .where(
        and(
          eq(serverJobConfigurations.serverId, serverId),
          eq(serverJobConfigurations.jobKey, "session-polling")
        )
      )
      .limit(1);

    // Default to enabled if no config exists
    return configs.length === 0 || configs[0].enabled;
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  private countTrackedSessions(): number {
    let total = 0;
    for (const m of this.trackedSessions.values()) {
      total += m.size;
    }
    return total;
  }

  private generateSessionKey(session: JellyfinSession): string {
    const sid = session.Id ?? "";
    if (sid) return `sid:${sid}`;

    const userId = session.UserId || "";
    const deviceId = session.DeviceId || "";
    const item = session.NowPlayingItem;
    const itemId = item?.Id || "";
    const seriesId = item?.SeriesId || "";

    return `${userId}|${deviceId}|${seriesId}|${itemId}`;
  }

  private filterValidSessions(sessions: JellyfinSession[]): JellyfinSession[] {
    return sessions.filter((session) => {
      const item = session.NowPlayingItem;
      if (!item) return false;

      const itemType = item.Type;
      const providerIds = item.ProviderIds || {};

      return itemType !== "Trailer" && !("prerolls.video" in providerIds);
    });
  }

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

  private calculateDuration(tracked: TrackedSession, currentPaused: boolean): number {
    const wasPaused = tracked.isPaused;
    const now = Date.now();
    const elapsedSinceLastUpdate = Math.floor(
      (now - tracked.lastUpdateTime.getTime()) / 1000
    );

    // Was playing, now paused or still playing - add elapsed time
    if (!wasPaused) {
      return tracked.playDuration + Math.max(0, elapsedSinceLastUpdate);
    }

    // Was paused, now playing or still paused - no change
    return tracked.playDuration;
  }

  private getFinalDuration(tracked: TrackedSession, now: Date): number {
    let finalDuration = tracked.playDuration;
    if (!tracked.isPaused) {
      const timeDiff = Math.floor((now.getTime() - tracked.lastUpdateTime.getTime()) / 1000);
      finalDuration += timeDiff;
    }
    return finalDuration;
  }

  private getPercentComplete(tracked: TrackedSession): number {
    return tracked.runtimeTicks > 0
      ? (tracked.positionTicks / tracked.runtimeTicks) * 100
      : 0;
  }

  private parseDate(dateStr?: string): Date | undefined {
    if (!dateStr) return undefined;
    try {
      return new Date(dateStr);
    } catch {
      return undefined;
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
}

// ============================================================================
// Singleton Export (survives HMR)
// ============================================================================
const GLOBAL_KEY = "__streamystats_session_poller__";

function getOrCreateSessionPoller(): SessionPoller {
  const global = globalThis as unknown as Record<string, SessionPoller | undefined>;

  if (!global[GLOBAL_KEY]) {
    global[GLOBAL_KEY] = new SessionPoller();
  }

  return global[GLOBAL_KEY];
}

export const sessionPoller = getOrCreateSessionPoller();
export { SessionPoller };
