"use client";

import { User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { PersonLibraryStats, PersonStats, PlayCountSortBy } from "@/lib/db/people-stats";
import type { ServerPublic } from "@/lib/types";
import { formatDuration } from "@/lib/utils";

interface Props {
  person: PersonStats | PersonLibraryStats;
  server: ServerPublic;
  variant: "watchtime" | "playcount" | "library";
  displayMode?: PlayCountSortBy;
}

function isPersonStats(
  person: PersonStats | PersonLibraryStats,
): person is PersonStats {
  return "totalWatchTime" in person;
}

export function PersonCard({ person, server, variant, displayMode }: Props) {
  const [hasError, setHasError] = useState(false);

  const imageUrl = person.primaryImageTag
    ? `${server.url}/Items/${person.id}/Images/Primary?fillHeight=300&fillWidth=200&quality=96&tag=${person.primaryImageTag}`
    : null;

  // Generate initials for fallback
  const initials = person.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const renderStats = () => {
    if (variant === "library") {
      return (
        <p className="text-xs font-medium text-primary">
          {person.itemCount} {person.itemCount === 1 ? "title" : "titles"}
        </p>
      );
    }

    if (!isPersonStats(person)) {
      return null;
    }

    // For playcount variant, show stats based on displayMode
    if (variant === "playcount") {
      if (displayMode === "titleCount") {
        return (
          <>
            <p className="text-xs font-medium text-primary">
              {person.itemCount} {person.itemCount === 1 ? "title" : "titles"}
            </p>
            <p className="text-xs text-muted-foreground">
              {person.totalPlayCount.toLocaleString()} plays
            </p>
          </>
        );
      }
      return (
        <>
          <p className="text-xs font-medium text-primary">
            {person.totalPlayCount.toLocaleString()} plays
          </p>
          <p className="text-xs text-muted-foreground">
            {person.itemCount} {person.itemCount === 1 ? "title" : "titles"}
          </p>
        </>
      );
    }

    // watchtime variant
    return (
      <>
        <p className="text-xs font-medium text-primary">
          {formatDuration(person.totalWatchTime)}
        </p>
        <p className="text-xs text-muted-foreground">
          {person.itemCount} {person.itemCount === 1 ? "title" : "titles"}
        </p>
      </>
    );
  };

  return (
    <Link
      href={`/servers/${server.id}/actors/${encodeURIComponent(person.id)}`}
      className="flex-shrink-0 group"
    >
      <div className="w-[140px] rounded-lg border border-border bg-card overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all duration-200">
        {/* Image section */}
        <div className="w-full aspect-[2/3] bg-muted relative">
          {imageUrl && !hasError ? (
            <Image
              src={imageUrl}
              alt={person.name}
              fill
              className="object-cover"
              onError={() => setHasError(true)}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              {initials ? (
                <span className="text-2xl font-semibold text-muted-foreground/50">
                  {initials}
                </span>
              ) : (
                <User className="w-12 h-12 text-muted-foreground/30" />
              )}
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="p-3">
          <h3 className="text-sm font-semibold truncate" title={person.name}>
            {person.name}
          </h3>
          <p className="text-xs text-muted-foreground">{person.type}</p>
          <div className="mt-2">{renderStats()}</div>
        </div>
      </div>
    </Link>
  );
}
