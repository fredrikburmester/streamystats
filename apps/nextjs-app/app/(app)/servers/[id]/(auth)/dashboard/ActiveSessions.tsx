"use client";

import JellyfinAvatar from "@/components/JellyfinAvatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ActiveSession, getActiveSessions } from "@/lib/db/active-sessions";
import { Server } from "@streamystats/database/schema";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  Clock,
  Cog,
  Film,
  Monitor,
  MonitorPlay,
  Pause,
  Play,
  Smartphone,
  Tv,
  User,
  Video,
  Zap,
} from "lucide-react";
import Link from "next/link";
import LoadingSessions from "./LoadingSessions";
import { Poster } from "./Poster";

// Utility: show seconds ago if < 60s, else use formatDistanceToNow
function formatDistanceWithSeconds(date: Date) {
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // in seconds
  if (diff < 1) {
    return "just now";
  }
  if (diff < 60) {
    return `${diff} second${diff === 1 ? "" : "s"} ago`;
  }
  return formatDistanceToNow(date, { addSuffix: true });
}

export function ActiveSessions({ server }: { server: Server }) {
  const { data, isPending, error } = useQuery({
    queryKey: ["activeSessions", server.id],
    queryFn: () => getActiveSessions(server.id),
    refetchInterval: 5000, // Increased from 500ms to 5s to reduce load during connectivity issues
    // Don't throw on error, handle it gracefully instead
    retry: 1,
    retryDelay: 3000,
  });

  // Safely handle data sorting - ensure data is an array first and filter out null sessions
  const sortedSessions = Array.isArray(data)
    ? data
        .filter((session) => session !== null && session !== undefined)
        .sort((a, b) => (b.positionTicks || 0) - (a.positionTicks || 0))
    : [];

  if (isPending) {
    return <LoadingSessions />;
  }

  // Show a special message when there's an error fetching sessions
  if (error) {
    return (
      <Card className="border-0 p-0 m-0">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="flex items-center gap-2">
            <MonitorPlay className="h-5 w-5" />
            <span>Active Sessions</span>
          </CardTitle>
          <CardDescription>
            Currently playing content on your server
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 m-0">
          <div className="flex items-center gap-2 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
            <p>
              Unable to retrieve active sessions - Jellyfin server may be down
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!sortedSessions || sortedSessions.length === 0) {
    return (
      <Card className="border-0 p-0 m-0">
        <CardHeader className="px-0 pt-0">
          <CardTitle className="flex items-center gap-2">
            <MonitorPlay className="h-5 w-5" />
            <span>Active Sessions</span>
          </CardTitle>
          <CardDescription>
            Currently playing content on your server
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 m-0">
          <p className="text-muted-foreground">
            No active sessions at the moment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 p-0 m-0">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="flex items-center gap-2">
          <MonitorPlay className="h-5 w-5" />
          <span>Active Sessions</span>
          <Badge variant="outline" className="ml-2">
            {sortedSessions.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Currently playing content on your server
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="">
          <div
            className={
              sortedSessions.length === 1
                ? "grid grid-cols-1 gap-4 w-full max-w-full"
                : sortedSessions.length === 2
                ? "grid grid-cols-1 xl:grid-cols-2 gap-4 w-full max-w-full"
                : sortedSessions.length === 3
                ? "grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4 w-full max-w-full"
                : "grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 3xl:grid-cols-4 gap-4 w-full max-w-full"
            }
          >
            {sortedSessions.map((session) => {
              // Additional safety check - skip if session is null/undefined
              if (!session) return null;

              return (
                <div
                  key={session.sessionKey}
                  className="border rounded-lg p-4 w-full flex flex-col h-full"
                >
                  <div className="flex flex-row gap-2 w-full min-w-0 max-[350px]:flex-col flex-1">
                    {/* Poster */}
                    <div className="w-20 sm:w-24 flex-shrink-0 flex items-start mr-3 mb-0">
                      {session.item && (
                        <Poster
                          item={session.item}
                          server={server}
                          size="large"
                        />
                      )}
                    </div>
                    {/* Info (always right of poster unless <350px) */}
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      {/* Top row: title, tag, duration */}
                      <div className="flex flex-wrap items-center gap-2 min-w-0 sm:flex-nowrap sm:justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {session.isPaused ? (
                            <Pause className="h-4 w-4 text-amber-500" />
                          ) : (
                            <Play className="h-4 w-4 text-green-500" />
                          )}
                          <h3 className="font-semibold text-lg truncate">
                            {session.item?.name || "Unknown"}
                          </h3>
                          <MediaTypeBadge type={session.item?.type} />
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground sm:justify-end sm:text-right">
                          <Clock className="h-3 w-3" />
                          {session.formattedPosition} /{" "}
                          {session.formattedRuntime}
                        </div>
                      </div>
                      {/* Username/Avatar */}
                      <div className="flex justify-start">
                        {session.user ? (
                          <Link
                            href={`/servers/${server.id}/users/${session.user.id}`}
                            className="flex items-center gap-2 group"
                          >
                            <JellyfinAvatar
                              user={session.user}
                              serverUrl={server.url}
                              className="h-6 w-6 rounded-lg transition-transform duration-200"
                            />
                            <span className="text-sm font-medium transition-colors duration-200 group-hover:text-primary">
                              {session.user.name}
                            </span>
                          </Link>
                        ) : (
                          <span className="text-sm font-medium flex items-center gap-2">
                            <User className="h-6 w-6 text-muted-foreground" />
                            Unknown User
                          </span>
                        )}
                      </div>
                      {/* Series info */}
                      {session.item?.seriesName && (
                        <div className="text-sm text-muted-foreground">
                          {session.item.seriesName}
                          {session.item.parentIndexNumber &&
                            session.item.indexNumber && (
                              <span>
                                {" "}
                                - S{session.item.parentIndexNumber}:E
                                {session.item.indexNumber}
                              </span>
                            )}
                        </div>
                      )}
                      {/* Info row */}
                      <TooltipProvider>
                        <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground items-center w-full min-w-0">
                          {/* Device */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1">
                                <Monitor className="h-4 w-4 text-blue-400" />
                                <b>Device:</b> {session.deviceName}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Device</TooltipContent>
                          </Tooltip>
                          <span className="mx-1">•</span>
                          {/* Client */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1">
                                <Smartphone className="h-4 w-4 text-purple-400" />
                                <b>Client:</b> {session.client}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Client</TooltipContent>
                          </Tooltip>
                          <span className="mx-1">•</span>
                          {/* Video */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="flex items-center gap-1">
                                <Video
                                  className={
                                    "h-4 w-4 " +
                                    (session.transcodingInfo
                                      ? session.transcodingInfo.isVideoDirect
                                        ? "text-green-500"
                                        : "text-amber-500"
                                      : "text-gray-400")
                                  }
                                />
                                <b>Video:</b>{" "}
                                {session.transcodingInfo
                                  ? session.transcodingInfo.isVideoDirect
                                    ? "Direct Play"
                                    : "Transcode"
                                  : session.playMethod || "Unknown"}
                                {session.transcodingInfo?.videoCodec && (
                                  <span className="ml-1">
                                    (
                                    {session.transcodingInfo.videoCodec.toUpperCase()}
                                    {session.transcodingInfo.bitrate
                                      ? ` - ${(
                                          session.transcodingInfo.bitrate /
                                          1000000
                                        ).toFixed(1)} Mbps`
                                      : ""}
                                    )
                                  </span>
                                )}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Video playback method
                              {session.transcodingInfo?.transcodeReasons &&
                                session.transcodingInfo.transcodeReasons
                                  .length > 0 && (
                                  <div className="mt-1">
                                    <div className="font-semibold">
                                      Transcode reasons:
                                    </div>
                                    <ul className="list-disc list-inside">
                                      {session.transcodingInfo.transcodeReasons.map(
                                        (reason: string, index: number) => (
                                          <li key={index}>{reason}</li>
                                        )
                                      )}
                                    </ul>
                                  </div>
                                )}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                      {/* Progress */}
                      <div className="mt-auto pt-2">
                        <Progress
                          value={session.progressPercent || 0}
                          className="h-2"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MediaTypeBadge({ type }: { type?: string }) {
  if (!type) return null;

  const icon = type === "Movie" ? Film : Tv;
  const Icon = icon;

  return (
    <Badge variant="outline" className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {type}
    </Badge>
  );
}

function PlaybackMethodBadge({ session }: { session: ActiveSession }) {
  const isTranscoding =
    session.transcodingInfo && !session.transcodingInfo.isVideoDirect;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1">
            {isTranscoding ? (
              <Cog className="h-4 w-4 text-amber-500" />
            ) : (
              <Zap className="h-4 w-4 text-green-500" />
            )}
            <span className="text-xs text-muted-foreground">
              {isTranscoding
                ? `Transcoding (${
                    session.transcodingInfo?.videoCodec || "unknown"
                  })`
                : "Direct Play"}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isTranscoding
              ? `Transcoding video to ${session.transcodingInfo?.videoCodec}`
              : "Direct playing without transcoding"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
