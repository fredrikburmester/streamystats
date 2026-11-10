"use client";

import type { Item } from "@streamystats/database/schema";
import { Calendar, Clock, Play, Tv } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Blurhash } from "react-blurhash";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SeasonEpisode } from "@/lib/db/items";
import { getInternalUrl } from "@/lib/server-url";
import type { ServerPublic } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface SeasonsAndEpisodesProps {
  seasons: SeasonEpisode[];
  serverId: number;
  server: ServerPublic;
}

function EpisodePoster({
  episode,
  server,
}: {
  episode: Item;
  server: ServerPublic;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const imageUrl = useMemo(() => {
    if (!episode.id) return null;

    if (episode.primaryImageTag) {
      return `${getInternalUrl(server)}/Items/${episode.id}/Images/Primary?fillHeight=90&fillWidth=160&quality=96&tag=${episode.primaryImageTag}`;
    }

    if (episode.primaryImageThumbTag) {
      return `${getInternalUrl(server)}/Items/${episode.id}/Images/Thumb?fillHeight=90&fillWidth=160&quality=96&tag=${episode.primaryImageThumbTag}`;
    }

    if (episode.backdropImageTags && episode.backdropImageTags.length > 0) {
      return `${getInternalUrl(server)}/Items/${episode.id}/Images/Backdrop?fillHeight=90&fillWidth=160&quality=96&tag=${episode.backdropImageTags[0]}`;
    }

    return null;
  }, [
    episode.id,
    episode.primaryImageTag,
    episode.primaryImageThumbTag,
    episode.backdropImageTags,
    server.url,
    server.internalUrl,
  ]);

  const blurHash = useMemo(() => {
    if (!episode.imageBlurHashes) return null;
    const blurHashes = episode.imageBlurHashes;

    if (
      episode.primaryImageTag &&
      blurHashes.Primary?.[episode.primaryImageTag]
    ) {
      return blurHashes.Primary[episode.primaryImageTag];
    }
    if (
      episode.primaryImageThumbTag &&
      blurHashes.Thumb?.[episode.primaryImageThumbTag]
    ) {
      return blurHashes.Thumb[episode.primaryImageThumbTag];
    }
    if (
      episode.backdropImageTags &&
      episode.backdropImageTags.length > 0 &&
      blurHashes.Backdrop?.[episode.backdropImageTags[0]]
    ) {
      return blurHashes.Backdrop[episode.backdropImageTags[0]];
    }
    return null;
  }, [
    episode.imageBlurHashes,
    episode.primaryImageTag,
    episode.primaryImageThumbTag,
    episode.backdropImageTags,
  ]);

  if (!imageUrl || hasError) {
    return (
      <div className="w-full h-full bg-muted flex items-center justify-center rounded-md">
        <div className="flex flex-col items-center gap-1">
          <Tv className="h-4 w-4 text-muted-foreground/70" />
          <span className="text-[10px] text-muted-foreground/70">No Image</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden rounded-md">
      {blurHash && isLoading && (
        <Blurhash
          hash={blurHash}
          width={32}
          height={18}
          resolutionX={32}
          resolutionY={18}
          punch={1}
          className="absolute inset-0"
        />
      )}
      <Image
        src={imageUrl}
        alt={`${episode.name} poster`}
        width={160}
        height={90}
        className={`object-cover w-full h-full transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
      />
    </div>
  );
}

export function SeasonsAndEpisodes({
  seasons,
  serverId,
  server,
}: SeasonsAndEpisodesProps) {
  if (seasons.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Play className="w-5 h-5" />
          Seasons & Episodes
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Accordion type="single" collapsible className="w-full">
          {seasons.map((season) => (
            <AccordionItem
              key={season.seasonNumber}
              value={`season-${season.seasonNumber}`}
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <span className="font-semibold text-base">
                    Season {season.seasonNumber}
                  </span>
                  <span className="text-sm text-muted-foreground font-normal">
                    {season.episodes.length} episode
                    {season.episodes.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {season.episodes.map((episode) => (
                    <Link
                      key={episode.id}
                      href={`/servers/${serverId}/library/${episode.id}`}
                      className="flex items-start gap-4 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/50 transition-all duration-200 group"
                    >
                      <div className="flex-shrink-0 w-24 aspect-video overflow-hidden rounded-md bg-muted">
                        <EpisodePoster episode={episode} server={server} />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-start gap-2">
                          <span className="text-sm font-medium text-muted-foreground flex-shrink-0">
                            E{episode.indexNumber}
                          </span>
                          <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {episode.name}
                          </h3>
                        </div>
                        {episode.overview && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {episode.overview}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {episode.runtimeTicks && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>
                                {formatDuration(
                                  Math.floor(episode.runtimeTicks / 10_000_000),
                                )}
                              </span>
                            </div>
                          )}
                          {episode.premiereDate && (
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>
                                {new Date(
                                  episode.premiereDate,
                                ).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
