import { Item, User } from "@streamystats/database/schema";
import { toast } from "sonner";

export type ActiveSession = {
  sessionKey: string;
  user: User | null;
  item: Item;
  client: string;
  deviceName: string;
  deviceId: string;
  positionTicks: number;
  formattedPosition: string;
  runtimeTicks: number;
  formattedRuntime: string;
  progressPercent: number;
  playbackDuration: number;
  lastActivityDate: string | null;
  isPaused: boolean;
  playMethod: string | null;
  transcodingInfo?: {
    videoCodec: string;
    audioCodec: string;
    container: string;
    isVideoDirect: boolean;
    isAudioDirect: boolean;
    bitrate: number;
    width: number;
    height: number;
    audioChannels: number;
    hardwareAccelerationType: string;
    transcodeReasons: string[];
  };
  ipAddress?: string;
};
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const getActiveSessions = async (
  serverId: number
): Promise<ActiveSession[]> => {
  try {
    const response = await fetch(`${basePath}/api/Sessions?serverId=${serverId}`);
    if (!response.ok) {
      if (response.status >= 500) {
        throw new Error("Server error - Jellyfin server may be down");
      }
      throw new Error(`Error fetching sessions: ${response.statusText}`);
    }
    const data = await response.json();
    if (!Array.isArray(data)) {
      console.error("Expected array but got:", data);
      return [];
    }
    return data as ActiveSession[];
  } catch (err) {
    console.error("Failed to fetch active sessions:", err);
    toast.error("Jellyfin Connectivity Issue", {
      id: "jellyfin-sessions-error",
      description: "Cannot retrieve active sessions from the Jellyfin server.",
      duration: 5000,
    });
    return [];
  }
};
