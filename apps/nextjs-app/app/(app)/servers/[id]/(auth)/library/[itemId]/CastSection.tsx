"use client";

import { Clapperboard, PenTool, User, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { PersonFromDb } from "@/lib/db/actor-types";
import { getInternalUrl } from "@/lib/server-url";
import type { ServerPublic } from "@/lib/types";

interface CastSectionProps {
  cast: PersonFromDb[];
  directors: PersonFromDb[];
  writers: PersonFromDb[];
  server: ServerPublic;
  serverId: number;
}

function PersonCard({
  person,
  server,
  serverId,
}: {
  person: PersonFromDb;
  server: ServerPublic;
  serverId: number;
}) {
  const [hasError, setHasError] = useState(false);

  const imageUrl = person.primaryImageTag
    ? `${getInternalUrl(server)}/Items/${person.id}/Images/Primary?fillHeight=240&fillWidth=160&quality=96&tag=${person.primaryImageTag}`
    : null;

  return (
    <div className="flex-shrink-0 group relative">
      <div className="relative w-[120px] sm:w-[140px] py-2">
        <Link
          href={`/servers/${serverId}/actors/${encodeURIComponent(person.id)}`}
          className="flex flex-col overflow-hidden border border-border bg-card rounded-lg hover:border-primary/50 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:z-10 relative"
        >
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
            <div className="w-full h-[160px] sm:h-[180px] bg-muted">
              {imageUrl && !hasError ? (
                <Image
                  src={imageUrl}
                  alt={person.name}
                  width={160}
                  height={240}
                  className="w-full h-full object-cover rounded-t-lg"
                  onError={() => setHasError(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center rounded-t-lg">
                  <User className="w-12 h-12 text-muted-foreground/30" />
                </div>
              )}
            </div>
          </div>

          <div className="p-2.5 space-y-0.5 bg-gradient-to-b from-card to-card/95">
            <h3 className="text-foreground text-xs font-bold truncate">
              {person.name}
            </h3>
            {person.role && (
              <p className="text-muted-foreground text-[10px] truncate">
                {person.role}
              </p>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
}

function CrewList({
  people,
  serverId,
  title,
  icon,
}: {
  people: PersonFromDb[];
  serverId: number;
  title: string;
  icon: React.ReactNode;
}) {
  if (people.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        {icon}
        <span>{title}:</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {people.map((person, index) => (
          <Link
            key={person.id}
            href={`/servers/${serverId}/actors/${encodeURIComponent(person.id)}`}
            className="text-sm font-medium hover:text-primary transition-colors"
          >
            {person.name}
            {index < people.length - 1 && ","}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function CastSection({
  cast,
  directors,
  writers,
  server,
  serverId,
}: CastSectionProps) {
  const hasPeople =
    cast.length > 0 || directors.length > 0 || writers.length > 0;

  if (!hasPeople) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4" />
          Cast & Crew
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {(directors.length > 0 || writers.length > 0) && (
          <div className="space-y-2">
            <CrewList
              people={directors}
              serverId={serverId}
              title="Director"
              icon={<Clapperboard className="w-3.5 h-3.5" />}
            />
            <CrewList
              people={writers}
              serverId={serverId}
              title="Writer"
              icon={<PenTool className="w-3.5 h-3.5" />}
            />
          </div>
        )}

        {cast.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Cast ({cast.length})
            </div>
            <ScrollArea dir="ltr" className="w-full py-1">
              <div className="flex gap-3 flex-nowrap w-max">
                {cast.map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    server={server}
                    serverId={serverId}
                  />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
