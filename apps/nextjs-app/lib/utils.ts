import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface SyncTask {
  sync_type: string;
  sync_started_at: string;
  sync_completed_at: string;
}

/*
 * export and normalize basePath
 * use process.env.NEXT_PUBLIC_BASE_PATH if set and normalize "/my/base/url"
 * when unset or set to "/" we default to "" (empty)
 */
const normalizeBasePath = (path: string): string => {
    // Trim trailing slashes
    const trimmedPath = path.replace(/\/+$/, "");

    // Ensure a single leading slash
    return trimmedPath === "" ? "" : `/${trimmedPath.replace(/^\/+/, "")}`;
};
export const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDuration(
  t: number,
  unit: "seconds" | "minutes" | "hours" | "days" = "seconds"
): string {
  if (t === 0) return "0m";

  let totalSeconds = t;
  switch (unit) {
    case "minutes":
      totalSeconds *= 60;
      break;
    case "hours":
      totalSeconds *= 3600;
      break;
    case "days":
      totalSeconds *= 86400;
      break;
  }
  const years = Math.floor(totalSeconds / 31536000);
  const months = Math.floor((totalSeconds % 31536000) / 2592000);
  const days = Math.floor((totalSeconds % 2592000) / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  const parts: string[] = [];

  if (years > 0) parts.push(`${years}y`);
  if (months > 0) parts.push(`${months}mo`);
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && years === 0 && months === 0 && days === 0 && hours === 0)
    parts.push(`${seconds}s`);

  return parts.join(" ") || "0m";
}

export function formatDateUS(date: string | Date | null): string {
  if (!date) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export const isTaskRunning = (
  data?: SyncTask[] | null,
  type?: SyncTask["sync_type"] | null
): boolean => {
  if (!type) return false;
  if (!data) return false;

  return data?.some((task) => {
    if (!task.sync_started_at) return false;

    const taskStartTime = new Date(task.sync_started_at);
    const currentTime = new Date();

    return (
      taskStartTime.getTime() <= currentTime.getTime() &&
      task.sync_type === type &&
      !task.sync_completed_at
    );
  });
};

export const taskLastRunAt = (
  data?: SyncTask[] | null,
  type?: SyncTask["sync_type"] | null
): string => {
  if (!type) return "Never";
  if (!data) return "Never";

  const d = data?.find((task) => task.sync_type === type)?.sync_completed_at;
  if (!d) return "Never";

  const utcDate = new Date(d);
  return new Date(
    utcDate.getTime() - utcDate.getTimezoneOffset() * 60000
  ).toLocaleString();
};

export const formatDate = (s: string): string => {
  const date = new Date(s);
  return date.toLocaleString("en-UK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const globalFetch = global.fetch;
export const fetch = async (url: string | Request, options?: RequestInit): Promise<Response> => {
  if (typeof url === 'string' && url.startsWith('/')) {
    url = `${basePath}${url}`;
  }

  return globalFetch(url, options);
};
