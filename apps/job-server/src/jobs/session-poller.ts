import {
  db,
  servers,
  sessions,
  users,
  NewSession,
} from "@streamystats/database";
import { JellyfinClient } from "../jellyfin/client";
import {
  JellyfinSession,
  TrackedSession,
  ActiveSessionResponse,
} from "../jellyfin/types";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";

interface SessionPollerConfig {
  intervalMs?: number;
  enabled?: boolean;
}

interface SessionChanges {
  newSessions: JellyfinSession[];
  updatedSessions: JellyfinSession[];
  endedSessions: Array<{ key: string; session: TrackedSession }>;
}

class SessionPoller {
  private trackedSessions: Map<string, Map<string, TrackedSession>> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private config: Required<SessionPollerConfig>;

  constructor(config: SessionPollerConfig = {}) {
    this.config = {
      intervalMs: config.intervalMs || 5000, // 5 seconds as requested
      enabled: config.enabled ?? true,
    };
  }

  /**
   * Start the session poller
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log("Session poller is disabled");
      return;
    }

    console.log(
      `Starting session poller with interval: ${this.config.intervalMs}ms`
    );

    // Initial poll
    await this.pollSessions();

    // Schedule recurring polls
    this.intervalId = setInterval(async () => {
      try {
        await this.pollSessions();
      } catch (error) {
        console.error("Error during session polling:", error);
      }
    }, this.config.intervalMs);

    console.log("Session poller started successfully");
  }

  /**
   * Stop the session poller
   */
  stop(): void {
    console.log("Stopping session poller...");

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    console.log("Session poller stopped");
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
  private async pollSessions(): Promise<void> {
    try {
      const activeServers = await this.listServers();

      for (const server of activeServers) {
        await this.pollServer(server);
      }
    } catch (error) {
      console.error("Error polling sessions:", error);
    }
  }

  /**
   * List all active servers
   */
  private async listServers() {
    return await db.select().from(servers);
  }

  /**
   * Poll sessions for a specific server
   */
  private async pollServer(server: any): Promise<void> {
    try {
      const client = JellyfinClient.fromServer(server);
      const currentSessions = await client.getSessions();
      await this.processSessions(server, currentSessions);
    } catch (error) {
      console.error(`Failed to fetch sessions for server ${server.id}:`, error);
    }
  }

  /**
   * Process sessions for a server
   */
  private async processSessions(
    server: any,
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
    const currentMap = this.sessionsToMap(currentSessions);

    const newSessions = currentSessions.filter((session) => {
      const key = this.generateSessionKey(session);
      return !trackedSessions.has(key);
    });

    const updatedSessions = currentSessions.filter((session) => {
      const key = this.generateSessionKey(session);
      return trackedSessions.has(key);
    });

    const endedSessions = Array.from(trackedSessions.entries())
      .filter(([key]) => !currentMap.has(key))
      .map(([key, session]) => ({ key, session }));

    return { newSessions, updatedSessions, endedSessions };
  }

  /**
   * Generate a unique session key
   */
  private generateSessionKey(session: JellyfinSession): string {
    const userId = session.UserId || "";
    const deviceId = session.DeviceId || "";
    const item = session.NowPlayingItem;
    const itemId = item?.Id || "";
    const seriesId = item?.SeriesId || "";

    if (seriesId) {
      return `${userId}|${deviceId}|${seriesId}|${itemId}`;
    } else {
      return `${userId}|${deviceId}|${itemId}`;
    }
  }

  /**
   * Convert sessions array to a map keyed by session key
   */
  private sessionsToMap(
    sessions: JellyfinSession[]
  ): Map<string, JellyfinSession> {
    const map = new Map<string, JellyfinSession>();
    for (const session of sessions) {
      const key = this.generateSessionKey(session);
      map.set(key, session);
    }
    return map;
  }

  /**
   * Handle new sessions
   */
  private async handleNewSessions(
    server: any,
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

      console.info(
        `New session for server ${server.id}: User: ${session.UserName}, ` +
          `Content: ${item.Name}, Paused: ${isPaused}, Duration: 0s`
      );

      tracked.set(sessionKey, trackingRecord);
    }

    return tracked;
  }

  /**
   * Handle updated sessions
   */
  private async handleUpdatedSessions(
    server: any,
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
        console.debug(
          `Updated session for server ${server.id}: User: ${tracked.userName}, ` +
            `Content: ${tracked.itemName}, Paused: ${currentPaused}, ` +
            `Duration: ${updatedDuration}s, Position: ${this.formatTicksAsTime(
              currentPosition
            )}`
        );
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
    server: any,
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

        console.info(
          `Ended session for server ${server.id}: User: ${tracked.userName}, ` +
            `Content: ${tracked.itemName}, Final duration: ${finalDuration}s, ` +
            `Progress: ${
              Math.round(percentComplete * 10) / 10
            }%, Completed: ${completed}`
        );

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
    server: any,
    tracked: TrackedSession,
    finalDuration: number,
    percentComplete: number,
    completed: boolean
  ): Promise<void> {
    try {
      // Get user from database using jellyfin ID
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, tracked.userJellyfinId))
        .limit(1);

      const playbackRecord: NewSession = {
        id: uuidv4(),
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
        isTranscoded: tracked.playMethod !== "DirectPlay",
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

      await db.insert(sessions).values(playbackRecord);
      console.info(
        `Successfully saved playback session for server ${server.id}`
      );
    } catch (error) {
      console.error("Failed to save playback session:", error);
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

    if (config.intervalMs && this.intervalId) {
      // Restart with new interval
      this.stop();
      this.start();
    }
  }

  /**
   * Get poller status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      intervalMs: this.config.intervalMs,
      isRunning: this.intervalId !== null,
      trackedServers: this.trackedSessions.size,
      totalTrackedSessions: Array.from(this.trackedSessions.values()).reduce(
        (total, serverSessions) => total + serverSessions.size,
        0
      ),
    };
  }
}

// Export singleton instance
export const sessionPoller = new SessionPoller();

export { SessionPoller, SessionPollerConfig };
