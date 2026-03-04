"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { RecommendationItem } from "@/lib/db/similar-statistics";
import type { ServerPublic } from "@/lib/types";

const SimilarStatistics = dynamic(
  () => import("./SimilarStatistics").then((mod) => mod.SimilarMovieStatistics),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    ),
  },
);

interface Props {
  data: RecommendationItem[];
  server: ServerPublic;
}

export function SimilarStatisticsClient({ data, server }: Props) {
  return <SimilarStatistics data={data} server={server} />;
}
