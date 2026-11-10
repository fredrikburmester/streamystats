"use client";

import {
  BookOpen,
  Bug,
  Calculator,
  Clock,
  Egg,
  Fish,
  Flag,
  Flame,
  Ghost,
  Gift,
  Globe,
  Heart,
  Laugh,
  Leaf,
  type LucideIcon,
  Moon,
  PartyPopper,
  Skull,
  Sparkles,
  User,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Poster } from "@/app/(app)/servers/[id]/(auth)/dashboard/Poster";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  getSeasonalRecommendations,
  type SeasonalRecommendationResult,
} from "@/lib/db/seasonal-recommendations";
import type { ServerPublic } from "@/lib/types";

// Map icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  BookOpen,
  Bug,
  Calculator,
  Clock,
  Egg,
  Fish,
  Flag,
  Flame,
  Ghost,
  Gift,
  Globe,
  Heart,
  Laugh,
  Leaf,
  Moon,
  PartyPopper,
  Skull,
  Sparkles,
  User,
  Users,
  UtensilsCrossed,
  // Fallbacks
  Clover: Leaf, // No Clover in lucide-react, use Leaf
  Rainbow: Sparkles, // No Rainbow, use Sparkles
};

// Holiday-specific gradient themes
const holidayThemes: Record<
  string,
  { gradient: string; accent: string; badge: string }
> = {
  christmas: {
    gradient: "from-red-500/20 via-green-500/10 to-red-500/20",
    accent: "text-red-500",
    badge: "bg-red-500/20 text-red-400",
  },
  halloween: {
    gradient: "from-orange-500/20 via-purple-500/10 to-orange-500/20",
    accent: "text-orange-500",
    badge: "bg-orange-500/20 text-orange-400",
  },
  "valentines-day": {
    gradient: "from-pink-500/20 via-red-500/10 to-pink-500/20",
    accent: "text-pink-500",
    badge: "bg-pink-500/20 text-pink-400",
  },
  "star-wars-day": {
    gradient: "from-yellow-500/20 via-blue-500/10 to-yellow-500/20",
    accent: "text-yellow-500",
    badge: "bg-yellow-500/20 text-yellow-400",
  },
  "pride-month": {
    gradient: "from-red-500/10 via-yellow-500/10 to-blue-500/10",
    accent: "text-purple-500",
    badge: "bg-purple-500/20 text-purple-400",
  },
  "friday-the-13th": {
    gradient: "from-red-900/30 via-black/20 to-red-900/30",
    accent: "text-red-600",
    badge: "bg-red-900/30 text-red-400",
  },
  "st-patricks-day": {
    gradient: "from-green-500/20 via-green-600/10 to-green-500/20",
    accent: "text-green-500",
    badge: "bg-green-500/20 text-green-400",
  },
  "april-fools": {
    gradient: "from-purple-500/20 via-pink-500/10 to-purple-500/20",
    accent: "text-purple-500",
    badge: "bg-purple-500/20 text-purple-400",
  },
  "earth-day": {
    gradient: "from-green-500/20 via-blue-500/10 to-green-500/20",
    accent: "text-green-500",
    badge: "bg-green-500/20 text-green-400",
  },
  easter: {
    gradient: "from-purple-500/20 via-pink-500/10 to-purple-500/20",
    accent: "text-purple-400",
    badge: "bg-purple-500/20 text-purple-400",
  },
  thanksgiving: {
    gradient: "from-orange-500/20 via-amber-600/10 to-orange-500/20",
    accent: "text-orange-500",
    badge: "bg-orange-500/20 text-orange-400",
  },
  "independence-day": {
    gradient: "from-blue-500/20 via-red-500/10 to-blue-500/20",
    accent: "text-blue-500",
    badge: "bg-blue-500/20 text-blue-400",
  },
  "lunar-new-year": {
    gradient: "from-red-500/20 via-yellow-500/10 to-red-500/20",
    accent: "text-red-500",
    badge: "bg-red-500/20 text-red-400",
  },
  diwali: {
    gradient: "from-yellow-500/20 via-orange-500/10 to-yellow-500/20",
    accent: "text-yellow-500",
    badge: "bg-yellow-500/20 text-yellow-400",
  },
  hanukkah: {
    gradient: "from-blue-500/20 via-white/10 to-blue-500/20",
    accent: "text-blue-400",
    badge: "bg-blue-500/20 text-blue-400",
  },
  "new-years": {
    gradient: "from-yellow-500/20 via-purple-500/10 to-yellow-500/20",
    accent: "text-yellow-400",
    badge: "bg-yellow-500/20 text-yellow-400",
  },
  "pi-day": {
    gradient: "from-blue-500/20 via-purple-500/10 to-blue-500/20",
    accent: "text-blue-500",
    badge: "bg-blue-500/20 text-blue-400",
  },
  "back-to-the-future-day": {
    gradient: "from-orange-500/20 via-blue-500/10 to-orange-500/20",
    accent: "text-orange-500",
    badge: "bg-orange-500/20 text-orange-400",
  },
  "alien-day": {
    gradient: "from-green-900/20 via-black/20 to-green-900/20",
    accent: "text-green-500",
    badge: "bg-green-500/20 text-green-400",
  },
  "batman-day": {
    gradient: "from-yellow-500/20 via-gray-900/20 to-yellow-500/20",
    accent: "text-yellow-500",
    badge: "bg-yellow-500/20 text-yellow-400",
  },
  "tolkien-reading-day": {
    gradient: "from-green-700/20 via-amber-600/10 to-green-700/20",
    accent: "text-green-500",
    badge: "bg-green-500/20 text-green-400",
  },
  "shark-week": {
    gradient: "from-blue-600/20 via-blue-800/10 to-blue-600/20",
    accent: "text-blue-500",
    badge: "bg-blue-500/20 text-blue-400",
  },
  "black-history-month": {
    gradient: "from-amber-600/20 via-red-600/10 to-amber-600/20",
    accent: "text-amber-500",
    badge: "bg-amber-500/20 text-amber-400",
  },
  "womens-history-month": {
    gradient: "from-purple-500/20 via-pink-500/10 to-purple-500/20",
    accent: "text-purple-500",
    badge: "bg-purple-500/20 text-purple-400",
  },
  "hispanic-heritage-month": {
    gradient: "from-red-500/20 via-yellow-500/10 to-green-500/20",
    accent: "text-red-500",
    badge: "bg-red-500/20 text-red-400",
  },
};

const defaultTheme = {
  gradient: "from-primary/20 via-primary/10 to-primary/20",
  accent: "text-primary",
  badge: "bg-primary/20 text-primary",
};

function getHolidayTheme(holidayId: string) {
  return holidayThemes[holidayId] || defaultTheme;
}

function getHolidayIcon(iconName: string): LucideIcon {
  return iconMap[iconName] || Sparkles;
}

interface SeasonalRecommendationsProps {
  data: SeasonalRecommendationResult;
  server: ServerPublic;
}

export function SeasonalRecommendations({
  data,
  server,
}: SeasonalRecommendationsProps) {
  const { holiday, items: initialItems } = data;
  const theme = getHolidayTheme(holiday.id);
  const Icon = getHolidayIcon(holiday.icon);

  const [items, setItems] = useState(initialItems);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const formatRuntime = (ticks: number | null) => {
    if (!ticks) return null;
    const minutes = Math.floor(ticks / 600000000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes > 0 ? `${remainingMinutes}m` : ""}`;
    }
    return `${minutes}m`;
  };

  useEffect(() => {
    setItems(initialItems);
    setHasMore(true);
  }, [initialItems]);

  useEffect(() => {
    if (!sentinelRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry?.isIntersecting && !isLoading && hasMore) {
          setIsLoading(true);
          getSeasonalRecommendations({
            serverId: server.id,
            offset: items.length,
          })
            .then((result) => {
              if (!result || result.items.length === 0) {
                setHasMore(false);
              } else {
                setItems((prev) => [...prev, ...result.items]);
              }
            })
            .catch((error) => {
              console.error("Error fetching next page:", error);
            })
            .finally(() => {
              setIsLoading(false);
            });
        }
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0.1,
      },
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [server.id, items.length, isLoading, hasMore]);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div>
      <div
        className={`rounded-lg border bg-gradient-to-r ${theme.gradient} relative overflow-hidden`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent opacity-50" />
        <div className="relative z-10">
          <div className="p-4 pb-3">
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <div
                className={`p-1.5 rounded-lg bg-background/50 ${theme.accent}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <span>{holiday.name}</span>
              <Badge
                variant="outline"
                className={`ml-2 text-[10px] ${theme.badge} border-0`}
              >
                Seasonal
              </Badge>
            </h2>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <Sparkles className="h-3 w-3" />
              {holiday.description}
            </p>
          </div>

          <div className="">
            <ScrollArea dir="ltr" className="w-full py-1">
              <div className="flex gap-4 flex-nowrap px-4 w-max">
                {items.map((recommendation) => {
                  const { item } = recommendation;

                  return (
                    <div
                      key={item.id || `${item.name}-${item.productionYear}`}
                      className="flex-shrink-0 group relative"
                    >
                      <div className="relative w-[152px] sm:w-[184px] py-2">
                        <Link
                          href={`/servers/${server.id}/library/${item.id}`}
                          className="flex flex-col overflow-hidden border border-border bg-card rounded-lg hover:border-primary/50 hover:shadow-xl transition-all duration-300 hover:scale-[1.02] hover:z-10 relative"
                        >
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
                            <Poster
                              item={item}
                              server={server}
                              width={184}
                              height={240}
                              preferredImageType="Primary"
                              className="w-full h-[208px] sm:h-[256px] rounded-t-lg"
                            />
                            <div className="absolute top-2 left-2 z-20">
                              <Badge
                                className={`${theme.badge} backdrop-blur-sm border-0 shadow-lg text-xs px-1.5 py-0.5`}
                              >
                                <Icon className="h-2.5 w-2.5 mr-1" />
                                {holiday.name}
                              </Badge>
                            </div>
                          </div>

                          <div className="p-3 space-y-2 bg-gradient-to-b from-card to-card/95">
                            <div>
                              <h3 className="text-foreground text-sm font-bold truncate">
                                {item.name}
                              </h3>
                              <p className="text-muted-foreground text-xs mt-0.5 flex items-center gap-1.5">
                                {item.productionYear}
                                {item.runtimeTicks &&
                                  formatRuntime(item.runtimeTicks) && (
                                    <>
                                      <span>•</span>
                                      {formatRuntime(item.runtimeTicks)}
                                    </>
                                  )}
                                {item.type === "Series" && (
                                  <>
                                    <span>•</span>
                                    Series
                                  </>
                                )}
                              </p>
                            </div>
                          </div>
                        </Link>
                      </div>
                    </div>
                  );
                })}
                <div ref={sentinelRef} className="flex-shrink-0 w-4" />
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
