"use client";

import { Clock, Film, Play, User } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ActorDetailsResponse } from "@/lib/db/actors";
import { getInternalUrl } from "@/lib/server-url";
import type { ServerPublic } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface ActorHeaderProps {
  actor: ActorDetailsResponse;
  server: ServerPublic;
}

function StatTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

export function ActorHeader({ actor, server }: ActorHeaderProps) {
  const [hasError, setHasError] = useState(false);

  const imageUrl = actor.primaryImageTag
    ? `${getInternalUrl(server)}/Items/${actor.id}/Images/Primary?fillHeight=400&fillWidth=300&quality=96&tag=${actor.primaryImageTag}`
    : null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-shrink-0 mx-auto lg:mx-0">
            <div className="w-40 aspect-[2/3] rounded-lg overflow-hidden bg-muted">
              {imageUrl && !hasError ? (
                <Image
                  src={imageUrl}
                  alt={actor.name}
                  width={300}
                  height={400}
                  className="w-full h-full object-cover"
                  onError={() => setHasError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-16 h-16 text-muted-foreground/30" />
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
                {actor.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge variant="outline" className="text-sm">
                  {actor.type}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <StatTile
                label="Appearances"
                value={actor.totalItems}
                icon={<Film className="w-4 h-4" />}
              />
              <StatTile
                label="Total Views"
                value={actor.totalViews}
                icon={<Play className="w-4 h-4" />}
              />
              <StatTile
                label="Watch Time"
                value={formatDuration(actor.totalWatchTime)}
                icon={<Clock className="w-4 h-4" />}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
