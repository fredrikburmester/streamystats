import { getWrappedData } from "@/lib/db/wrapped";
import type { ServerPublic } from "@/lib/types";
import {
  ActivityPatternsSection,
  DominantGenreSection,
  FirstLastPlaysSection,
  FooterSection,
  HeroSection,
  MostPlayedSection,
  MostWatchedPeopleSection,
  RewatchSection,
  YearInNumbersSection,
} from "./sections";

interface WrappedContentProps {
  serverId: number;
  userId: string;
  userName: string;
  year: number;
  availableYears: number[];
  server: ServerPublic;
  isAdminView?: boolean;
}

export async function WrappedContent({
  serverId,
  userId,
  userName,
  year,
  availableYears,
  server,
  isAdminView = false,
}: WrappedContentProps) {
  const data = await getWrappedData({ serverId, userId, year });

  const firstGenre = data.overview.firstWatch?.genres?.[0];
  const lastGenre = data.overview.lastWatch?.genres?.[0];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <HeroSection
        year={year}
        userName={isAdminView ? userName : "your"}
        availableYears={availableYears}
        serverId={serverId}
        userId={isAdminView ? userId : undefined}
      />

      <FirstLastPlaysSection
        year={year}
        firstWatch={data.overview.firstWatch}
        lastWatch={data.overview.lastWatch}
        firstGenre={firstGenre}
        lastGenre={lastGenre}
        server={server}
        serverId={serverId}
      />

      <DominantGenreSection
        year={year}
        topGenres={data.genres.topGenres}
        genrePercentiles={data.genrePercentiles}
        totalGenresExplored={data.genres.totalGenresExplored}
      />

      <MostPlayedSection
        movies={data.topItems.movies}
        series={data.topItems.series}
        server={server}
        serverId={serverId}
      />

      <YearInNumbersSection
        year={year}
        overview={data.overview}
        typeBreakdown={data.typeBreakdown}
        rewatchStats={data.rewatchStats}
        activityPatterns={data.activityPatterns}
      />

      <ActivityPatternsSection activityPatterns={data.activityPatterns} />

      <MostWatchedPeopleSection
        year={year}
        topActors={data.people.topActors}
        topDirectors={data.people.topDirectors}
        server={server}
        serverId={serverId}
        movieCount={data.typeBreakdown.movie.playCount}
        episodeCount={data.typeBreakdown.episode.playCount}
      />

      <RewatchSection
        rewatchStats={data.rewatchStats}
        server={server}
        serverId={serverId}
      />

      <FooterSection year={year} />
    </div>
  );
}
