"use client";

import { Sparkles } from "lucide-react";
import { getForYouRecommendations } from "@/lib/db/recommendations";
import type { ForYouRecommendation } from "@/lib/db/recommendations-core";
import { hideRecommendation } from "@/lib/db/similar-statistics";
import type { ServerPublic } from "@/lib/types";
import { RecommendationsSection } from "./RecommendationsSection";

interface Props {
  data: ForYouRecommendation[];
  server: ServerPublic;
}

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

export const ForYouMovies = ({ data, server }: Props) => {
  const fetchNextPage = async (offset: number) => {
    return getForYouRecommendations({
      serverId: server.id,
      mediaType: "Movie",
      offset,
    });
  };

  return (
    <RecommendationsSection
      title="Movies For You"
      description="Personalized picks from your taste profile, viewing patterns, and library connections"
      icon={Sparkles}
      recommendations={data}
      server={server}
      onHideRecommendation={hideRecommendation}
      formatRuntime={formatRuntime}
      emptyMessage="Watch a few movies and recommendations will appear here"
      fetchNextPage={fetchNextPage}
      requiresEmbeddings={false}
    />
  );
};

export const ForYouSeries = ({ data, server }: Props) => {
  const fetchNextPage = async (offset: number) => {
    return getForYouRecommendations({
      serverId: server.id,
      mediaType: "Series",
      offset,
    });
  };

  return (
    <RecommendationsSection
      title="Series For You"
      description="Personalized picks from your taste profile, viewing patterns, and library connections"
      icon={Sparkles}
      recommendations={data}
      server={server}
      onHideRecommendation={hideRecommendation}
      emptyMessage="Watch a few series and recommendations will appear here"
      fetchNextPage={fetchNextPage}
      requiresEmbeddings={false}
    />
  );
};
