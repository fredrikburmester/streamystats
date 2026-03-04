"use client";

import { Monitor } from "lucide-react";
import {
  getSimilarSeries,
  hideSeriesRecommendation,
  type SeriesRecommendationItem,
  type RecommendationSource,
} from "@/lib/db/similar-series-statistics";
import type { ServerPublic } from "@/lib/types";
import { RecommendationsSection } from "./RecommendationsSection";

interface Props {
  data: SeriesRecommendationItem[];
  source: RecommendationSource;
  server: ServerPublic;
}

export const SimilarSeriesStatistics = ({ data, source, server }: Props) => {
  const fetchNextPage = async (offset: number) => {
    const response = await getSimilarSeries(server.id, undefined, 20, offset);
    return response.results;
  };

  const title =
    source === "server"
      ? "Popular Series on This Server"
      : "Recommended Series for You";
  const description =
    source === "server"
      ? "Series that are popular among users on this server"
      : "Personalized recommendations based on your viewing history";

  return (
    <RecommendationsSection
      title={title}
      description={description}
      icon={Monitor}
      recommendations={data}
      server={server}
      onHideRecommendation={hideSeriesRecommendation}
      emptyMessage="No series recommendations available yet"
      fetchNextPage={fetchNextPage}
    />
  );
};
