"use client";

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
import { ActiveSession, Server } from "@/lib/db";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  Clock,
  Film,
  MonitorPlay,
  Pause,
  Play,
  Tv,
  User,
  Cog,
  Zap,
  Monitor,
  Smartphone,
  Volume2,
  Video,
  Globe2,
  AlertTriangle,
} from "lucide-react";
import LoadingSessions from "./LoadingSessions";
import { Poster } from "./Poster";
import JellyfinAvatar from "@/components/JellyfinAvatar";
import Link from "next/link";
import { toast } from "sonner";
import { getExternalUrl } from "@/utils/getServerUrl";

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
    queryFn: async () => {
      try {
        const response = await fetch(`/api/Sessions?serverId=${server.id}`);
        if (!response.ok) {
          // Handle non-200 responses
          if (response.status >= 500) {
            throw new Error("Server error - Jellyfin server may be down");
          }
          throw new Error(`Error fetching sessions: ${response.statusText}`);
        }
        const data = await response.json();
        // Ensure data is an array
        if (!Array.isArray(data)) {
          console.error("Expected array but got:", data);
          return [];
        }
        return data as ActiveSession[];
      } catch (err) {
        console.error("Failed to fetch active sessions:", err);
        // Show toast notification for connectivity issues
        toast.error("Jellyfin Connectivity Issue", {
          id: "jellyfin-sessions-error",
          description:
            "Cannot retrieve active sessions from the Jellyfin server.",
          duration: 5000,
        });
        // Return empty array to prevent rendering errors
        return [];
      }
    },
    refetchInterval: 5000, // Increased from 500ms to 5s to reduce load during connectivity issues
    // Don't throw on error, handle it gracefully instead
    retry: 1,
    retryDelay: 3000,
  });

  // Safely handle data sorting - ensure data is an array first
  const sortedSessions = Array.isArray(data)
    ? data.sort((a, b) => b.position_ticks - a.position_ticks)
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
            {sortedSessions.map((session) => (
              <div
                key={session.session_key}
                className="border rounded-lg p-4 w-full flex flex-col h-full"
              >
                <div className="flex flex-row gap-2 w-full min-w-0 max-[350px]:flex-col flex-1">
                  {/* Poster */}
                  <div className="w-20 sm:w-24 flex-shrink-0 flex items-start mr-3 mb-0">
                    <Poster item={session.item} server={server} size="large" />
                  </div>
                  {/* Info (always right of poster unless <350px) */}
                  <div className="flex-1 flex flex-col gap-2 min-w-0">
                    {/* Top row: title, tag, duration */}
                    <div className="flex flex-wrap items-center gap-2 min-w-0 sm:flex-nowrap sm:justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        {session.is_paused ? (
                          <Pause className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Play className="h-4 w-4 text-green-500" />
                        )}
                        <h3 className="font-semibold text-lg truncate">
                          {session.item?.name}
                        </h3>
                        <MediaTypeBadge type={session.item?.type} />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground sm:justify-end sm:text-right">
                        <Clock className="h-3 w-3" />
                        {session.formatted_position} /{" "}
                        {session.formatted_runtime}
                      </div>
                    </div>
                    {/* Username/Avatar */}
                    <div className="flex justify-start">
                      {session.user ? (
                        <Link
                          href={`/servers/${server.id}/users/${session.user.jellyfin_id}`}
                          className="flex items-center gap-2 group"
                        >
                          <JellyfinAvatar
                            user={session.user}
                            serverUrl={getExternalUrl(server)}
                            className="h-6 w-6 rounded-lg transition-transform duration-200 group-hover:scale-110"
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
                    {session.item.series_name && (
                      <div className="text-sm text-muted-foreground">
                        {session.item.series_name}
                        {session.item.parent_index_number &&
                          session.item.index_number && (
                            <span>
                              {" "}
                              - S{session.item.parent_index_number}:E
                              {session.item.index_number}
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
                              <b>Device:</b> {session.device_name}
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
                                  (session.transcoding_info
                                    ? session.transcoding_info.is_video_direct
                                      ? "text-green-500"
                                      : "text-amber-500"
                                    : "text-gray-400")
                                }
                              />
                              <b>Video:</b>{" "}
                              {session.transcoding_info
                                ? session.transcoding_info.is_video_direct
                                  ? "Direct Play"
                                  : "Transcode"
                                : session.play_method || "Unknown"}
                              {session.transcoding_info?.video_codec && (
                                <span className="ml-1">
                                  (
                                  {session.transcoding_info.video_codec.toUpperCase()}
                                  {session.transcoding_info.bitrate
                                    ? ` - ${(
                                        session.transcoding_info.bitrate /
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
                            {session.transcoding_info?.transcode_reasons &&
                              session.transcoding_info.transcode_reasons
                                .length > 0 && (
                                <div className="mt-1">
                                  <div className="font-semibold">
                                    Transcode reasons:
                                  </div>
                                  <ul className="list-disc list-inside">
                                    {session.transcoding_info.transcode_reasons.map(
                                      (reason, index) => (
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
                        value={session.progress_percent || 0}
                        className="h-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
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
    session.transcoding_info && !session.transcoding_info.is_video_direct;

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
                    session.transcoding_info?.video_codec || "unknown"
                  })`
                : "Direct Play"}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isTranscoding
              ? `Transcoding video to ${session.transcoding_info?.video_codec}`
              : "Direct playing without transcoding"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
