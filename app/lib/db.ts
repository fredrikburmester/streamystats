"use server";

import { cookies, headers } from "next/headers";
import { getMe, UserMe } from "./me";
import { getToken } from "./token";
import { ItemStatistics } from "@/components/ItemDetails";

export type Server = {
  id: number;
  name: string;
  url: string;
  admin_id: string;
  api_key: string;
  open_ai_api_token?: string;
  auto_generate_embeddings?: boolean;
  ollama_api_token?: string;
  ollama_base_url?: string;
  ollama_model?: string;
  embedding_provider?: "openai" | "ollama";
};

export type SyncTask = {
  id: number;
  server_id: number;
  sync_type: "full_sync";
  status: "completed" | "failed";
  sync_started_at: string; // native datetime
  sync_completed_at: string; // native datetime
};

export type Item = {
  id?: number;
  jellyfin_id: string | null;
  name: string;
  type: "Episode" | "Movie" | "Series";
  original_title?: string | null;
  etag?: string | null;
  date_created?: string | null;
  container?: string | null;
  sort_name?: string | null;
  premiere_date?: string | null;
  external_urls?: Array<{ Name: string; Url: string }> | null;
  path?: string | null;
  official_rating?: string | null;
  overview?: string | null;
  genres?: string[] | null;
  community_rating?: number | null;
  runtime_ticks?: string | null;
  production_year?: number | null;
  is_folder?: boolean | null;
  parent_id?: string | null;
  media_type?: string | null;
  width?: number | null;
  height?: number | null;
  library_id?: number | null;
  server_id?: number | null;

  // Series and episode related fields
  series_name?: string | null;
  series_id?: string | null;
  season_id?: string | null;
  season_name?: string | null;
  index_number?: number | null;
  parent_index_number?: number | null;

  // Image related fields
  primary_image_tag?: string | null;
  backdrop_image_tags?: string[] | null;
  primary_image_thumb_tag?: string | null;
  primary_image_logo_tag?: string | null;
  image_blur_hashes?: {
    Primary?: Record<string, string>;
    Backdrop?: Record<string, string>;
    Thumb?: Record<string, string>;
    Logo?: Record<string, string>;
  } | null;
  primary_image_aspect_ratio?: number | null;

  // Parent image fields for episodes
  parent_backdrop_item_id?: string | null;
  parent_backdrop_image_tags?: string[] | null;
  parent_thumb_item_id?: string | null;
  parent_thumb_image_tag?: string | null;
  series_primary_image_tag?: string | null;

  // Additional media information
  video_type?: string | null;
  has_subtitles?: boolean | null;
  channel_id?: string | null;
  location_type?: string | null;

  // Timestamps
  inserted_at?: string | null;
  updated_at?: string | null;

  // Statistics (these might be included in some API responses)
  total_play_count?: number;
  total_play_duration?: number;

  // Recommendation-related fields
  similarity?: number;
  based_on?: Item[]; // Array of movies this recommendation is based on
};

export type MostWatchedItem = Item & {
  total_play_count: number;
  total_play_duration: number;
};

export type Statistics = {
  most_watched_items?: {
    Movie?: MostWatchedItem[];
    Episode?: MostWatchedItem[];
    Series?: MostWatchedItem[];
  };
  average_watchtime_per_week_day: {
    day_of_week: number;
    duration: number;
  }[];
  watchtime_per_week_day: {
    day_of_week: number;
    duration: number;
  }[];
  watchtime_per_hour: {
    hour: number;
    duration: number;
  }[];
  total_watch_time: number;
  most_watched_date: {
    date: string;
    total_duration: number;
  };
};

export type WatchTimePerDay = [
  {
    date: string;
    watchtime_by_type: {
      item_type: string;
      total_duration: number;
    }[];
  }
];

export type PlaybackActivity = {
  id: number;
  date_created: string;
  rowid: number;
  item_id: string;
  item_type: string | null;
  item_name: string | null;
  user: User;
  client_name: string | null;
  device_name: string | null;
  device_id: string | null;
  play_method: string | null;
  play_duration: number | null;
  play_count: number | null;
  server_id: number;
  inserted_at: string;
  updated_at: string;
};

export type GenreStat = {
  genre: string;
  watch_time: number;
};

export type UserWatchHisotryResponse = {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  data: UserPlaybackStatistics[];
};

export type User = {
  id: string;
  name: string | null;
  jellyfin_id: string | null;
  watch_stats: { total_watch_time: number; total_plays: number };
  watch_time_per_day: { date: string; total_duration: number }[];
  watch_time_per_weekday: { day_of_week: number; total_duration: number }[];
  is_administrator: boolean;
  genre_stats: GenreStat[];
  longest_streak: number; // days
  watch_history: UserWatchHisotryResponse;
};

export type ActiveSession = {
  session_key: string;
  user: {
    id: number;
    name: string;
    jellyfin_id: string;
  } | null;
  item: Item;
  client: string;
  device_name: string;
  device_id: string;
  position_ticks: number;
  formatted_position: string;
  runtime_ticks: number;
  formatted_runtime: string;
  progress_percent: number;
  playback_duration: number;
  last_activity_date: string | null;
  is_paused: boolean;
  play_method: string | null;
  transcoding_info?: {
    video_codec: string;
    audio_codec: string;
    container: string;
    is_video_direct: boolean;
    is_audio_direct: boolean;
    bitrate: number;
    width: number;
    height: number;
    audio_channels: number;
    hardware_acceleration_type: string;
    transcode_reasons: string[];
  };
  ip_address?: string;
};

export const getActiveSessions = async (
  serverId: number
): Promise<ActiveSession[]> => {
  try {
    const res = await fetch(
      `${process.env.API_URL}/servers/${serverId}/active-sessions`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      console.error("Failed to fetch active sessions:", res.statusText);
      return [];
    }

    const data = await res.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching active sessions:", error);
    return [];
  }
};

export const createServer = async (
  url: string,
  api_key: string
): Promise<Server> => {
  const result = await fetch(`${process.env.API_URL}/servers`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      api_key,
    }),
  });

  if (!result.ok) {
    throw new Error("Failed to create server");
  }

  const data = await result.json();

  return data.data as Server;
};

export const getServers = async (): Promise<Server[]> => {
  try {
    const res = await fetch(`${process.env.API_URL}/servers`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return data.data;
  } catch (e) {
    return [];
  }
};

export const getServer = async (
  serverId: number | string
): Promise<Server | null> => {
  try {
    const res = await fetch(`${process.env.API_URL}/servers/${serverId}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.data;
  } catch (e) {
    return null;
  }
};

export const login = async ({
  serverId,
  username,
  password,
}: {
  serverId: number;
  username: string;
  password?: string | null;
}): Promise<void> => {
  const res = await fetch(`${process.env.API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
      server_id: serverId,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to login");
  }

  const data = await res.json();
  const token = data.access_token;
  const user = data.user;

  const h = headers();

  const secure = h.get("x-forwarded-proto") === "https";

  const maxAge = 30 * 24 * 60 * 60;

  cookies().set("streamystats-token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge,
    secure,
  });

  cookies().set(
    "streamystats-user",
    JSON.stringify({
      name: user.Name,
      id: user.Id,
      serverId,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge,
      secure,
    }
  );
};

export const deleteServer = async (serverId: number): Promise<void> => {
  const me = await getMe();

  if (!me?.name) throw new Error("Unauthorized: No valid user found");

  const user = await getUser(me?.name, serverId);

  if (!user || !user.is_administrator) {
    throw new Error("Unauthorized: Only administrators can delete servers");
  }

  const token = await getToken();

  if (!token) {
    throw new Error("Unauthorized: No valid token found");
  }

  const res = await fetch(`${process.env.API_URL}/admin/servers/${serverId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Failed to delete server");
  }
};

export const getUsers = async (serverId: number): Promise<User[]> => {
  const res = await fetch(`${process.env.API_URL}/servers/${serverId}/users`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    return [];
  }

  const data = await res.json();
  return data.data;
};

export const getUser = async (
  name?: string,
  serverId?: number,
  page?: string
): Promise<User | null> => {
  if (!name || !serverId) return null;

  // Build URL with query parameters if pagination params are provided
  let url = `${process.env.API_URL}/servers/${serverId}/users/${name}`;

  if (page !== undefined) {
    const params = new URLSearchParams();
    if (page !== undefined) params.append("page", page);

    // Append query parameters to URL
    url += `?${params.toString()}`;
  }

  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data.data;
};

export interface Library {
  id: string;
  jellyfin_id: string;
  name: string;
  type: string;
  server_id: string;
  inserted_at: string;
  updated_at: string;
}

export const getLibraries = async (serverId: number): Promise<Library[]> => {
  const res = await fetch(
    `${process.env.API_URL}/servers/${serverId}/libraries`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  return data.data;
};

export const getItemStatistics = async (
  serverId: number | string,
  itemId: number | string
): Promise<{
  item: Item;
  statistics: ItemStatistics;
} | null> => {
  const res = await fetch(
    `${process.env.API_URL}/servers/${serverId}/statistics/items/${itemId}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
  }
  const data = await res.json();
  return data.data;
};

export const startTautulliImportTask = async (
  serverId: number,
  tautulliUrl: string,
  apiKey: string,
  mappings: Record<string, string>
) => {
  const res = await fetch(
    `${process.env.API_URL}/admin/servers/${serverId}/tautulli/import`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tautulli_url: tautulliUrl,
        api_key: apiKey,
        mappings: mappings,
      }),
    }
  );
  if (!res.ok) {
    throw new Error("Failed to start Tautulli import task");
  }
};

export const getStatistics = async (
  serverId: number,
  startDate: string,
  endDate: string
): Promise<Statistics | null> => {
  try {
    if (!startDate || !endDate) {
      return null;
    }

    if (new Date(startDate) > new Date(endDate)) {
      return null;
    }

    if (new Date(endDate) > new Date()) {
      return null;
    }

    const queryParams = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    const res = await fetch(
      `${process.env.API_URL}/servers/${serverId}/statistics?${queryParams}`,
      {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          "Content-Type": "application/json",
        },
        next: {
          revalidate: 60 * 1, // 1 minute
        },
      }
    );
    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.data as Statistics;
  } catch (e) {
    return null;
  }
};

export const getWatchTimeGraph = async (
  serverId: number,
  startDate: string,
  endDate: string
): Promise<WatchTimePerDay | null> => {
  try {
    if (!startDate || !endDate) {
      return null;
    }

    if (new Date(startDate) > new Date(endDate)) {
      return null;
    }

    if (new Date(endDate) > new Date()) {
      return null;
    }

    const queryParams = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    const res = await fetch(
      `${process.env.API_URL}/servers/${serverId}/statistics/watchtime_per_day?${queryParams}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.data as WatchTimePerDay;
  } catch (e) {
    return null;
  }
};

export type LibraryStatistics = {
  movies_count: number;
  episodes_count: number;
  series_count: number;
  libraries_count: number;
  users_count: number;
};

export const getStatisticsLibrary = async (
  serverId: number
): Promise<LibraryStatistics> => {
  const res = await fetch(
    `${process.env.API_URL}/servers/${serverId}/statistics/library`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    return {
      movies_count: 0,
      episodes_count: 0,
      series_count: 0,
      libraries_count: 0,
      users_count: 0,
    };
  }

  const data = await res.json();
  return data.data;
};

export type UserPlaybackStatistics = {
  id: string;
  date_created: string;
  item_id: string;
  item_type: string;
  item_name: string;
  client_name: string;
  device_name: string;
  play_method: string;
  play_duration: number;
  percent_complete: number;
  completed: boolean;
  series_name: string | null;
  season_name: string | null;
  index_number: number | null;
  primary_image_tag: string | null;
  backdrop_image_tags: string[] | null;
  image_blur_hashes: Record<string, Record<string, string>> | null;
  parent_backdrop_item_id: string | null;
  parent_backdrop_image_tags: string[] | null;
  parent_thumb_item_id: string | null;
  parent_thumb_image_tag: string | null;
  primary_image_aspect_ratio: number | null;
  series_primary_image_tag: string | null;
  primary_image_thumb_tag: string | null;
  primary_image_logo_tag: string | null;
  user_id: string;
  user_name: string;
  jellyfin_user_id: string;
  // Transcoding fields
  transcoding_audio_codec: string | null;
  transcoding_video_codec: string | null;
  transcoding_container: string | null;
  transcoding_is_video_direct: boolean | null;
  transcoding_is_audio_direct: boolean | null;
  transcoding_bitrate: number | null;
  transcoding_completion_percentage: number | null;
  transcoding_width: number | null;
  transcoding_height: number | null;
  transcoding_audio_channels: number | null;
  transcoding_hardware_acceleration_type: string | null;
  transcoding_reasons: string[] | null;
  remote_end_point: string | null;
};

export type HisotryResponse = {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  data: UserPlaybackStatistics[];
};

export const getStatisticsHistory = async (
  serverId: number,
  page = "1"
): Promise<HisotryResponse> => {
  // Build URL with query parameters
  const url = new URL(
    `${process.env.API_URL}/servers/${serverId}/statistics/history`
  );

  url.searchParams.append("page", page);

  const res = await fetch(url.toString(), {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    return {
      page: 1,
      per_page: 0,
      total_items: 0,
      total_pages: 1,
      data: [],
    };
  }

  const data = await res.json();
  return data;
};

export type ActivityLogEntry = {
  id: number;
  name: string;
  type: string;
  date: string;
  severity: string;
  server_id: number;
  jellyfin_id: number;
  short_overview: string;
  user_id: number;
  jellyfin_user_id: string | null;
};

export type ActivitiesResponse = {
  data: ActivityLogEntry[];
  page: number;
  per_page: number;
  total_pages: number;
  total_items: number;
};

export const getActivities = async (
  serverId: number,
  page = "1"
): Promise<ActivitiesResponse> => {
  const queryParams = new URLSearchParams({
    page: page.toString(),
  });

  const res = await fetch(
    `${
      process.env.API_URL
    }/admin/servers/${serverId}/activities?${queryParams.toString()}`,
    {
      next: {
        revalidate: 0,
      },
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    return {
      data: [],
      page: 1,
      per_page: 0,
      total_pages: 1,
      total_items: 0,
    };
  }

  const data = await res.json();
  return data;
};

export type ItemWatchStats = {
  item: Item;
  item_id: string;
  total_watch_time: number;
  watch_count: number;
};

export type ItemWatchStatsResponse = {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
  data: ItemWatchStats[];
};

export const getLibraryItems = async (
  serverId: number,
  page = "1",
  sort_order = "desc",
  sort_by = "total_watch_time",
  type?: "Movie" | "Episode" | "Series",
  search?: string,
  libraries?: string
): Promise<ItemWatchStatsResponse> => {
  const queryParams = new URLSearchParams({
    page: page,
    sort_order,
    sort_by,
    search: search || "",
    type: type || "",
    libraries: libraries || "",
  });

  if (search) {
    queryParams.append("search", search);
  }

  const res = await fetch(
    `${
      process.env.API_URL
    }/servers/${serverId}/statistics/items?${queryParams.toString()}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    return {
      data: [],
      page: 1,
      per_page: 0,
      total_pages: 1,
      total_items: 0,
    };
  }

  const data = await res.json();
  return data;
};

export async function getUnwatchedItems(
  serverId: number,
  page = 1,
  type = "movie"
) {
  try {
    const queryParams = new URLSearchParams({
      page: page.toString(),
      type: type,
    });

    const res = await fetch(
      `${
        process.env.API_URL
      }/servers/${serverId}/statistics/unwatched?${queryParams.toString()}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      console.error("Failed to fetch unwatched items:", res.statusText);
      throw new Error("Failed to fetch unwatched items");
    }

    return await res.json();
  } catch (error) {
    console.error("Error fetching unwatched items:", error);
    return null;
  }
}

export const logout = async (): Promise<void> => {
  cookies().delete("streamystats-token");
  cookies().delete("streamystats-user");
};

export const getSyncTasks = async (serverId: number): Promise<SyncTask[]> => {
  return fetch(`${process.env.API_URL}/admin/servers/${serverId}/sync/tasks`, {
    cache: "no-store",
    headers: {
      Authorization: `Bearer ${await getToken()}`,
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .then((data) => data.data);
};

export const getSyncTask = async (serverId: number, taskId: number) => {
  return fetch(
    `${process.env.API_URL}/admin/servers/${serverId}/sync/tasks/${taskId}`,
    {
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
      },
    }
  ).then((res) => res.json());
};

const executeSyncTask = async (
  serverId: number,
  endpoint: string
): Promise<void> => {
  const res = await fetch(
    `${process.env.API_URL}/admin/servers/${serverId}/sync${endpoint}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await getToken()}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    throw new Error("Failed to fetch data");
  }
};

export const syncFullTask = (serverId: number): Promise<void> => {
  return executeSyncTask(serverId, "/full");
};

export const syncPartialTask = (serverId: number): Promise<void> => {
  return executeSyncTask(serverId, "");
};

export const syncUsersTask = (serverId: number): Promise<void> => {
  return executeSyncTask(serverId, "/users");
};

export const syncLibrariesTask = (serverId: number): Promise<void> => {
  return executeSyncTask(serverId, "/libraries");
};

export type UserActivityPerDay = {
  date: string;
  active_users: number;
}[];

export const getUserActivityStatistics = async (
  serverId: number,
  startDate: string,
  endDate: string
): Promise<UserActivityPerDay | null> => {
  try {
    if (!startDate || !endDate) {
      return null;
    }

    if (new Date(startDate) > new Date(endDate)) {
      return null;
    }

    if (new Date(endDate) > new Date()) {
      return null;
    }

    const queryParams = new URLSearchParams({
      start_date: startDate,
      end_date: endDate,
    });

    const res = await fetch(
      `${process.env.API_URL}/servers/${serverId}/statistics/user_activity?${queryParams}`,
      {
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          "Content-Type": "application/json",
        },
        next: {
          revalidate: 60 * 1, // 1 minute
        },
      }
    );
    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.data as UserActivityPerDay;
  } catch (e) {
    return null;
  }
};
