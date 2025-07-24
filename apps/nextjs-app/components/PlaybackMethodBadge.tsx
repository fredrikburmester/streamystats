import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Cog, Zap, Video, Volume2 } from "lucide-react";
import React from "react";

export interface PlaybackMethodBadgeProps {
  isVideoDirect?: boolean | null;
  isAudioDirect?: boolean | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  bitrate?: number | null;
  playMethod?: string | null;
  width?: number | null;
  height?: number | null;
  audioChannels?: number | null;
}

export function PlaybackMethodBadge({
  isVideoDirect,
  isAudioDirect,
  videoCodec,
  audioCodec,
  bitrate,
  playMethod,
  width,
  height,
  audioChannels,
}: PlaybackMethodBadgeProps) {
  // Robust direct/transcode detection
  const isExplicitDirect =
    playMethod === "DirectPlay" || playMethod === "Direct";
  const isExplicitTranscode = playMethod === "Transcode";

  // For video/audio direct status, only consider them not direct if explicitly false
  const isVideoReallyDirect = isVideoDirect !== false;
  const isAudioReallyDirect = isAudioDirect !== false;

  // Consider it direct play if the play method is direct or both audio/video are direct
  const isReallyDirect =
    isExplicitDirect ||
    (isVideoReallyDirect && isAudioReallyDirect && !isExplicitTranscode);

  // Only consider it transcoding if explicitly set to transcode or if either video or audio is explicitly not direct
  const isReallyTranscode =
    isExplicitTranscode || isVideoDirect === false || isAudioDirect === false;

  // Label logic
  let label = "-";
  if (isReallyDirect) {
    label = "Direct Play";
  } else if (isReallyTranscode) {
    if (isVideoDirect === false && isAudioDirect === false) {
      label = "Transcode (A/V)";
    } else if (isVideoDirect === false) {
      label = "Transcode (Video)";
    } else if (isAudioDirect === false) {
      label = "Transcode (Audio)";
    } else {
      label = "Transcode";
    }
  } else if (isVideoDirect === true && isAudioDirect !== true) {
    label = "Direct Video";
  } else if (isAudioDirect === true && isVideoDirect !== true) {
    label = "Direct Audio";
  } else if (playMethod) {
    label = playMethod;
  }

  // Details for tooltip
  const videoDetail = videoCodec
    ? `${videoCodec.toUpperCase()}${
        typeof width === "number" && typeof height === "number"
          ? ` (${width}x${height})`
          : ""
      }`
    : null;
  const audioDetail = audioCodec
    ? `${audioCodec.toUpperCase()}${
        typeof audioChannels === "number" ? ` (${audioChannels}ch)` : ""
      }`
    : null;

  // Tooltip explanation for history
  let explanation = "";
  if (isReallyDirect) {
    explanation = "Direct play (no transcoding)";
  } else if (isVideoDirect === false && isAudioDirect === false) {
    explanation = `Video transcoded to ${
      videoDetail || "?"
    }, audio transcoded to ${audioDetail || "?"}`;
  } else if (isVideoDirect === false) {
    explanation = `Video transcoded to ${videoDetail || "?"}`;
  } else if (isAudioDirect === false) {
    explanation = `Audio transcoded to ${audioDetail || "?"}`;
  } else if (isExplicitTranscode) {
    explanation = `Transcoded${videoDetail ? ` to ${videoDetail}` : ""}${
      audioDetail ? ` / ${audioDetail}` : ""
    }`;
  } else {
    explanation = label;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1">
            {isReallyDirect ? (
              <Zap className="h-4 w-4 text-green-500" />
            ) : (
              <Cog className="h-4 w-4 text-amber-500" />
            )}
            <span className="text-xs text-muted-foreground">{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-1">
            <span>{explanation}</span>
            {videoDetail && <span>Video: {videoDetail}</span>}
            {audioDetail && <span>Audio: {audioDetail}</span>}
            {bitrate && (
              <span>Bitrate: {(bitrate / 1000000).toFixed(1)} Mbps</span>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
