export interface JellyfinPlayState {
  IsPaused?: boolean;
  PositionTicks?: number;
  PlayMethod?: string;
  IsMuted?: boolean;
  VolumeLevel?: number;
  AudioStreamIndex?: number;
  SubtitleStreamIndex?: number;
  MediaSourceId?: string;
  RepeatMode?: string;
  PlaybackOrder?: string;
}

export interface JellyfinTranscodingInfo {
  AudioCodec?: string;
  VideoCodec?: string;
  Container?: string;
  IsVideoDirect?: boolean;
  IsAudioDirect?: boolean;
  Bitrate?: number;
  CompletionPercentage?: number;
  Width?: number;
  Height?: number;
  AudioChannels?: number;
  HardwareAccelerationType?: string;
  TranscodeReasons?: string[];
}

export interface JellyfinNowPlayingItem {
  Id: string;
  Name?: string;
  SeriesId?: string;
  SeriesName?: string;
  SeasonId?: string;
  Type?: string;
  RunTimeTicks?: number;
  ProviderIds?: Record<string, string>;
}

export interface JellyfinSession {
  Id: string;
  UserId?: string;
  UserName?: string;
  Client?: string;
  DeviceId?: string;
  DeviceName?: string;
  ApplicationVersion?: string;
  IsActive?: boolean;
  RemoteEndPoint?: string;
  LastActivityDate?: string;
  LastPlaybackCheckIn?: string;
  LastPausedDate?: string;
  NowPlayingItem?: JellyfinNowPlayingItem;
  PlayState?: JellyfinPlayState;
  TranscodingInfo?: JellyfinTranscodingInfo;
}

export interface TrackedSession {
  sessionKey: string;
  userJellyfinId: string;
  userName: string;
  clientName?: string;
  deviceId?: string;
  deviceName?: string;
  /** Item the playback is stored against (the listed item for alternate versions). */
  itemId: string;
  /** Id Jellyfin reports as NowPlayingItem.Id; differs from itemId for alternate versions. */
  jellyfinItemId?: string;
  itemName?: string;
  seriesId?: string;
  seriesName?: string;
  seasonId?: string;
  positionTicks: number;
  runtimeTicks: number;
  playDuration: number;
  startTime: Date;
  lastActivityDate?: Date;
  lastPlaybackCheckIn?: Date;
  lastUpdateTime: Date;
  isPaused: boolean;
  playMethod?: string;

  // PlayState fields
  isMuted?: boolean;
  volumeLevel?: number;
  audioStreamIndex?: number;
  subtitleStreamIndex?: number;
  mediaSourceId?: string;
  repeatMode?: string;
  playbackOrder?: string;

  // Session fields
  remoteEndPoint?: string;
  sessionId: string;
  applicationVersion?: string;
  isActive?: boolean;

  // TranscodingInfo fields
  transcodingAudioCodec?: string;
  transcodingVideoCodec?: string;
  transcodingContainer?: string;
  transcodingIsVideoDirect?: boolean;
  transcodingIsAudioDirect?: boolean;
  transcodingBitrate?: number;
  transcodingCompletionPercentage?: number;
  transcodingWidth?: number;
  transcodingHeight?: number;
  transcodingAudioChannels?: number;
  transcodingHardwareAccelerationType?: string;
  transcodeReasons?: string[];
}

export interface ActiveSessionResponse {
  sessionKey: string;
  userJellyfinId: string;
  userName: string;
  clientName?: string;
  deviceId?: string;
  deviceName?: string;
  itemId: string;
  itemName?: string;
  seriesId?: string;
  seriesName?: string;
  seasonId?: string;
  positionTicks: number;
  runtimeTicks: number;
  playDuration: number;
  startTime: Date;
  lastActivityDate?: Date;
  isPaused: boolean;
  playMethod?: string;
}
