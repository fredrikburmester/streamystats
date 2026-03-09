"use client";

import { Monitor } from "lucide-react";
import {
  hideSeriesRecommendation,
  type SeriesRecommendationItem,
} from "@/lib/db/similar-series-statistics";
import { getSimilarStatistics } from "@/lib/db/similar-statistics";
import type { ServerPublic } from "@/lib/types";
import { RecommendationsSection } from "./RecommendationsSection";

interface Props {
  data: SeriesRecommendationItem[];
  server: ServerPublic;
}

export const SimilarSeriesStatistics = ({ data, server }: Props) => {
  const fetchNextPage = async (offset: number) => {
    return getSimilarStatistics({
      serverId: server.id,
      limit: 20,
      offset,
      type: "Series",
    });
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
