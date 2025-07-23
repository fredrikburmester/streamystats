"use client";

import { JellyseerrPoster } from "@/app/(app)/servers/[id]/(auth)/dashboard/JellyseerrPoster";
import { JellyseerrPopularMovie } from "@/lib/db/jellyseerr-items";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Server } from "@streamystats/database";
import { Film, Star, TrendingUp, CalendarDays } from "lucide-react";
import Link from "next/link";

interface Props {
  popularMovies: JellyseerrPopularMovie[];
  trendingMovies: JellyseerrPopularMovie[];
  server: Server;
}

export const JellyseerrPopularMovies = ({
  popularMovies,
  trendingMovies,
  server,
}: Props) => {
  // Format rating to show with star
  const formatRating = (rating: number | null) => {
    if (!rating) return null;
    return rating.toFixed(1);
  };

  // Format year from date
  const formatYear = (date: string | null) => {
    if (!date) return null;
    return new Date(date).getFullYear();
  };

  // Group movies by source type
  const groupedMovies = {
    popular: popularMovies.slice(0, 80),
    trending: trendingMovies.slice(0, 80),
  };

  // Combine all movies for "all" tab
  const allMovies = [...popularMovies, ...trendingMovies]
    .filter(
      (movie, index, arr) =>
        // Remove duplicates based on TMDB ID
        arr.findIndex((m) => m.id === movie.id) === index
    )
    .slice(0, 100);

  const tabs = [
    { key: "all", label: "All", icon: Film, movies: allMovies },
    {
      key: "popular",
      label: "Popular",
      icon: Star,
      movies: groupedMovies.popular,
    },
    {
      key: "trending",
      label: "Trending",
      icon: TrendingUp,
      movies: groupedMovies.trending,
    },
  ];

  // Default to first tab
  const defaultTab = tabs.length > 0 ? tabs[0].key : "all";

  if (
    (!popularMovies || popularMovies.length === 0) &&
    (!trendingMovies || trendingMovies.length === 0)
  ) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="h-5 w-5" />
            Popular Movies from Jellyseerr
          </CardTitle>
          <CardDescription>No popular movies available yet</CardDescription>
        </CardHeader>
        <CardContent className="px-5 m-0 pt-0 max-w-full">
          <div className="flex flex-col gap-2 max-w-full pt-4">
            <Link
              href={`/servers/${server.id}/settings/jellyseerr`}
              className="w-full sm:w-auto"
            >
              <Button className="w-full sm:w-auto text-sm" size="sm">
                Configure Jellyseerr Integration
              </Button>
            </Link>
            <p className="opacity-70 text-xs">
              To see popular movies from Jellyseerr, configure the integration
              in settings.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col max-w-full">
      <CardHeader className="px-4 sm:px-6 mb-0 pb-0">
        <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
          <Film className="h-5 w-5" />
          Popular Movies from Jellyseerr
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Discover popular and trending movies from The Movie Database
        </CardDescription>
      </CardHeader>
      <CardContent className="px-5 m-0 pt-0 max-w-full overflow-hidden">
        <Tabs defaultValue={defaultTab}>
          {/* Tab triggers */}
          <TabsList className="grid w-full grid-cols-3 mb-4">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="flex items-center gap-1"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Tab content */}
          {tabs.map((tab) => (
            <TabsContent key={tab.key} value={tab.key} className="">
              {/* Horizontal scrollable container */}
              <ScrollArea dir="ltr" className="py-4">
                <div className="flex gap-4 min-w-full w-max">
                  {tab.movies.map((movie) => (
                    <div
                      key={movie.id}
                      className="flex-shrink-0 group relative"
                    >
                      {/* External link to TMDB since we don't have Jellyseerr items in our library */}
                      <a
                        href={`https://www.themoviedb.org/${
                          movie.mediaType
                        }/${movie.id
                          .replace("jellyseerr-movie-", "")
                          .replace("jellyseerr-tv-", "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-[200px] sm:w-[240px] flex-col overflow-hidden border border-border bg-card rounded-lg hover:shadow-lg transition-all"
                      >
                        {/* Poster */}
                        <div className="relative">
                          <JellyseerrPoster
                            movie={movie}
                            width={240}
                            height={360}
                            className="w-full h-48 sm:h-56 rounded-b-none"
                          />
                        </div>

                        {/* Content */}
                        <div className="flex flex-col gap-2 p-3 flex-1">
                          <div className="space-y-1">
                            <h3 className="font-medium text-sm sm:text-base line-clamp-2">
                              {movie.title}
                            </h3>
                            {movie.productionYear && (
                              <p className="text-xs text-muted-foreground">
                                {movie.productionYear}
                              </p>
                            )}
                          </div>

                          {/* Overview */}
                          {movie.overview && (
                            <p className="text-xs text-muted-foreground line-clamp-3">
                              {movie.overview}
                            </p>
                          )}

                          {/* Metadata */}
                          <div className="flex flex-col gap-2 mt-auto">
                            {/* Rating */}
                            {movie.communityRating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                                <span className="text-xs text-muted-foreground">
                                  {formatRating(movie.communityRating)}
                                </span>
                              </div>
                            )}

                            {/* Genres */}
                            {movie.genres && movie.genres.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {movie.genres.slice(0, 3).map((genre) => (
                                  <Badge
                                    key={genre}
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0.5"
                                  >
                                    {genre}
                                  </Badge>
                                ))}
                              </div>
                            )}

                            {/* Source badge */}
                            <div className="flex items-center justify-between">
                              <Badge
                                variant={
                                  movie.sourceType === "trending"
                                    ? "default"
                                    : "outline"
                                }
                                className="text-[10px] px-1.5 py-0.5"
                              >
                                {movie.sourceType === "trending" ? (
                                  <TrendingUp className="h-2.5 w-2.5 mr-1" />
                                ) : (
                                  <Star className="h-2.5 w-2.5 mr-1" />
                                )}
                                {movie.sourceType === "trending"
                                  ? "Trending"
                                  : "Popular"}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </a>
                    </div>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
