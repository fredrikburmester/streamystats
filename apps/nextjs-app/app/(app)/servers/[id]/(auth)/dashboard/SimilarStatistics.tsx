"use client";

import { Film } from "lucide-react";
import {
  getSimilarStatistics,
  hideRecommendation,
  type RecommendationItem,
  type RecommendationSource,
} from "@/lib/db/similar-statistics";
import type { ServerPublic } from "@/lib/types";
import { RecommendationsSection } from "./RecommendationsSection";

interface Props {
  data: RecommendationItem[];
  source: RecommendationSource;
  server: ServerPublic;
}

export const SimilarMovieStatistics = ({ data, source, server }: Props) => {
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
    const response = await getSimilarStatistics(
      server.id,
      undefined,
      20,
      offset,
    );
    return response.results;
  };

  const title =
    source === "server"
      ? "Popular Movies on This Server"
      : "Recommended Movies for You";
  const description =
    source === "server"
      ? "Movies that are popular among users on this server"
      : "Personalized recommendations based on your viewing history";

  return (
    <RecommendationsSection
      title={title}
      description={description}
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
