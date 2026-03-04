"use client";

import { Film } from "lucide-react";
import {
  getSimilarStatistics,
  hideRecommendation,
  type RecommendationItem,
} from "@/lib/db/similar-statistics";
import type { ServerPublic } from "@/lib/types";
import { RecommendationsSection } from "./RecommendationsSection";

interface Props {
  data: RecommendationItem[];
  server: ServerPublic;
}

export const SimilarMovieStatistics = ({ data, server }: Props) => {
  const formatRuntime = (ticks: number | null) => {
    if (!ticks) {
      return null;
    }
    const minutes = Math.floor(ticks / 600000000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes > 0 ? `${remainingMinutes}m` : ""}`;
    }
    return `${minutes}m`;
  };

  const fetchNextPage = async (offset: number) => {
    return getSimilarStatistics(server.id, undefined, 20, offset);
  };

  return (
    <RecommendationsSection
      title="Recommended Movies for You"
      description="Personalized recommendations based on your viewing history"
      icon={Film}
      recommendations={data}
      server={server}
      onHideRecommendation={hideRecommendation}
      formatRuntime={formatRuntime}
      emptyMessage="No recommendations available yet"
      fetchNextPage={fetchNextPage}
    />
  );
};
