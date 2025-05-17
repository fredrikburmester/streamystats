"use server";

import { cookies, headers } from "next/headers";
import { getMe, UserMe } from "../me";
import { getToken } from "../token";
import { ItemStatistics } from "@/app/(app)/servers/[id]/(auth)/library/[libraryId]/[itemSlug]/ItemDetailsTable";

export interface CategoryStat {
  value: string | boolean | null;
  count: number;
  percentage: number;
}

// Type for numeric range distribution
export interface RangeDistribution {
  range: string;
  min: number;
  max: number;
  count: number;
}

// Type for numeric field statistics
export interface NumericStat {
  avg: number | null;
  min: number | null;
  max: number | null;
  count: number;
  distribution: RangeDistribution[];
}

// Type for directness statistics
export interface DirectnessStat {
  video_direct: boolean | null;
  audio_direct: boolean | null;
  label: string;
  count: number;
  percentage: number;
}

// Main type for the transcoding statistics response
export interface TranscodingStatisticsResponse {
  // Categorical fields
  transcoding_audio_codec: CategoryStat[];
  transcoding_video_codec: CategoryStat[];
  transcoding_container: CategoryStat[];
  transcoding_is_video_direct: CategoryStat[];
  transcoding_is_audio_direct: CategoryStat[];
  transcoding_hardware_acceleration_type: CategoryStat[];

  // Numeric fields
  transcoding_bitrate: NumericStat;
  transcoding_completion_percentage: NumericStat;
  transcoding_width: NumericStat;
  transcoding_height: NumericStat;
  transcoding_audio_channels: NumericStat;

  // Array field
  transcoding_reasons: CategoryStat[];

  // Combined statistics
  directness: DirectnessStat[];
}

export const getTranscodingStatistics = async (
  serverId: number | string
): Promise<TranscodingStatisticsResponse> => {
  const res = await fetch(
    `${process.env.API_URL}/servers/${serverId}/statistics/transcoding`,
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
