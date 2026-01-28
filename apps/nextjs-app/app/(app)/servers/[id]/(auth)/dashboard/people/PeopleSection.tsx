"use client";

import { Clock, Film, Library, Play, TrendingUp } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PersonLibraryStats, PersonStats, PlayCountSortBy } from "@/lib/db/people-stats";
import type { ServerPublic } from "@/lib/types";
import { PersonCard } from "./PersonCard";

export type IconType = "clock" | "play" | "film" | "trending" | "library";

const iconMap = {
  clock: Clock,
  play: Play,
  film: Film,
  trending: TrendingUp,
  library: Library,
} as const;

interface Props {
  title: string;
  description: string;
  iconType: IconType;
  people: (PersonStats | PersonLibraryStats)[];
  server: ServerPublic;
  variant: "watchtime" | "playcount" | "library";
  emptyMessage: string;
  playCountSort?: PlayCountSortBy;
}

export function PeopleSection({
  title,
  description,
  iconType,
  people,
  server,
  variant,
  emptyMessage,
  playCountSort,
}: Props) {
  const Icon = iconMap[iconType];
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleSortChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("playCountSort", value);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  if (!people || people.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-4 pb-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              {title}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>

          {variant === "playcount" && playCountSort && (
            <Tabs value={playCountSort} onValueChange={handleSortChange}>
              <TabsList className="h-8">
                <TabsTrigger value="titleCount" className="text-xs px-2 py-1">
                  Title Count
                </TabsTrigger>
                <TabsTrigger value="playCount" className="text-xs px-2 py-1">
                  Total Plays
                </TabsTrigger>
              </TabsList>
            </Tabs>
          )}
        </div>
      </div>

      <ScrollArea dir="ltr" className="w-full py-1">
        <div className="flex gap-4 flex-nowrap px-4 pb-4 w-max">
          {people.map((person) => (
            <PersonCard
              key={person.id}
              person={person}
              server={server}
              variant={variant}
              displayMode={variant === "playcount" ? playCountSort : undefined}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
