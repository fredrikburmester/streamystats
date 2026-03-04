"use client";

import { Monitor } from "lucide-react";
import {
  getSimilarSeries,
  hideSeriesRecommendation,
  type SeriesRecommendationItem,
} from "@/lib/db/similar-series-statistics";
import type { ServerPublic } from "@/lib/types";
import { RecommendationsSection } from "./RecommendationsSection";

interface Props {
  data: SeriesRecommendationItem[];
  server: ServerPublic;
}

export const SimilarSeriesStatistics = ({ data, server }: Props) => {
  const fetchNextPage = async (offset: number) => {
    return getSimilarSeries(server.id, undefined, 20, offset);
  };

  return (
    <RecommendationsSection
      title="Recommended Series for You"
      description="Personalized recommendations based on your viewing history"
      icon={Monitor}
      recommendations={data}
      server={server}
      onHideRecommendation={hideSeriesRecommendation}
      emptyMessage="No series recommendations available yet"
      fetchNextPage={fetchNextPage}
    />
  );
};
