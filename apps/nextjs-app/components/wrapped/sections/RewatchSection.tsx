"use client";

import { Repeat } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import type { RewatchStats } from "@/lib/db/wrapped";
import type { ServerPublic } from "@/lib/types";
import { getJellyfinImageUrl } from "@/lib/utils";
import {
  AccentHighlight,
  Highlight,
  SectionHeader,
  SubsectionHeader,
  Tagline,
} from "./shared";

interface RewatchSectionProps {
  rewatchStats: RewatchStats;
  server: ServerPublic;
  serverId: number;
}

function getItemSubtitle(
  seriesName: string | null,
  productionYear: number | null,
): string | null {
  if (seriesName !== null) {
    return seriesName;
  }
  if (productionYear !== null) {
    return `(${productionYear})`;
  }
  return null;
}

export function RewatchSection({
  rewatchStats,
  server,
  serverId,
}: RewatchSectionProps) {
  if (rewatchStats.totalRewatches === 0) return null;

  const topRewatched = rewatchStats.topRewatchedItems.slice(0, 5);

  return (
    <section className="relative py-28 px-4 md:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-transparent to-transparent" />

      <div className="max-w-6xl mx-auto relative">
        <SectionHeader icon={Repeat} label="On repeat" title="Most Replayed" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-12"
        >
          <div className="flex items-start gap-4">
            <div className="hidden md:block w-px self-stretch bg-gradient-to-b from-blue-400 to-transparent" />
            <p className="text-xl md:text-2xl text-white/70 max-w-2xl leading-relaxed">
              <AccentHighlight>
                {rewatchStats.rewatchPercentage}%
              </AccentHighlight>{" "}
              of your watches were replays
              {rewatchStats.totalRewatches > 0 && (
                <>
                  . That's{" "}
                  <Highlight>{rewatchStats.totalRewatches} rewatches</Highlight>
                </>
              )}
              . <Tagline>Familiar favorites hit different.</Tagline>
            </p>
          </div>
        </motion.div>

        {topRewatched.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <SubsectionHeader>
              Top {topRewatched.length} most replayed
            </SubsectionHeader>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4 md:gap-6">
              {topRewatched.map((item, index) => {
                const imageUrl = getJellyfinImageUrl(
                  server.url,
                  item.itemId,
                  item.primaryImageTag,
                );
                const subtitle = getItemSubtitle(
                  item.seriesName,
                  item.productionYear,
                );

                return (
                  <Link
                    key={item.itemId}
                    href={`/servers/${serverId}/library/${item.itemId}`}
                    className="group"
                  >
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 shadow-xl shadow-black/40 group-hover:shadow-black/50 transition-shadow mb-3">
                      {imageUrl ? (
                        <Image
                          src={imageUrl}
                          alt={item.itemName}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          sizes="150px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 text-xs p-2 text-center">
                          {item.itemName}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                      <div className="absolute bottom-2 right-2">
                        <span className="text-2xl font-black text-white">
                          .{(index + 1).toString().padStart(2, "0")}
                        </span>
                      </div>
                    </div>
                    <h4 className="font-semibold text-sm group-hover:text-blue-300 transition-colors truncate uppercase">
                      {item.itemName}
                    </h4>
                    {subtitle !== null && (
                      <p className="text-xs text-white/50">{subtitle}</p>
                    )}
                    <p className="text-xs text-white/50">
                      {item.playCount} plays
                    </p>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
