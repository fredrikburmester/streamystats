"use client";

import { Users } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import type { PersonStats } from "@/lib/db/wrapped";
import type { ServerPublic } from "@/lib/types";
import { getJellyfinImageUrl } from "@/lib/utils";

interface MostWatchedPeopleSectionProps {
  year: number;
  topActors: PersonStats[];
  topDirectors: PersonStats[];
  server: ServerPublic;
  serverId: number;
  movieCount: number;
  episodeCount: number;
}

interface PersonCardProps {
  person: PersonStats;
  rank: number;
  server: ServerPublic;
  serverId: number;
  delay: number;
}

function PersonCard({
  person,
  rank,
  server,
  serverId,
  delay,
}: PersonCardProps) {
  const imageUrl = getJellyfinImageUrl(
    server.url,
    person.id,
    person.primaryImageTag,
    { width: 200, height: 300 },
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.5, delay }}
    >
      <Link
        href={`/servers/${serverId}/actors/${person.id}`}
        className="group block"
      >
        <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-white/5 shadow-xl shadow-black/40 group-hover:shadow-black/50 transition-shadow mb-3">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={person.name}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              sizes="150px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
              No Photo
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
          <div className="absolute bottom-2 right-2">
            <span className="text-2xl font-black text-white">
              .{rank.toString().padStart(2, "0")}
            </span>
          </div>
        </div>
        <h4 className="font-semibold text-sm group-hover:text-blue-300 transition-colors truncate">
          {person.name}
        </h4>
        <p className="text-xs text-white/50">
          {person.itemCount} {person.itemCount === 1 ? "title" : "titles"}
        </p>
      </Link>
    </motion.div>
  );
}

export function MostWatchedPeopleSection({
  year,
  topActors,
  topDirectors,
  server,
  serverId,
  movieCount,
  episodeCount,
}: MostWatchedPeopleSectionProps) {
  if (topActors.length === 0 && topDirectors.length === 0) return null;

  return (
    <section className="relative py-24 px-4 md:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-950/30 via-transparent to-transparent" />

      <div className="max-w-6xl mx-auto relative">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-8 h-8 text-blue-400" strokeWidth={1.5} />
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
              Most Watched
            </h2>
          </div>
          <p className="text-lg text-white/60 max-w-2xl">
            In <span className="text-white font-semibold">{year}</span> you
            watched{" "}
            <span className="text-blue-400 font-semibold">
              {movieCount} movies
            </span>
            {episodeCount > 0 && (
              <>
                , and{" "}
                <span className="text-blue-400 font-semibold">
                  {episodeCount} episodes
                </span>
              </>
            )}
            . During this journey you discovered stories brought to life by
            countless actors and directors. Here's the{" "}
            <span className="text-white font-semibold">top 5</span> of each
            category.
          </p>
        </motion.div>

        {topActors.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-16"
          >
            <h3 className="text-xl font-semibold mb-6">Actors</h3>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4 md:gap-6">
              {topActors.slice(0, 5).map((actor, index) => (
                <PersonCard
                  key={actor.id}
                  person={actor}
                  rank={index + 1}
                  server={server}
                  serverId={serverId}
                  delay={0.1 + index * 0.05}
                />
              ))}
            </div>
          </motion.div>
        )}

        {topDirectors.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h3 className="text-xl font-semibold mb-6">Directors</h3>
            <div className="grid grid-cols-3 md:grid-cols-5 gap-4 md:gap-6">
              {topDirectors.slice(0, 5).map((director, index) => (
                <PersonCard
                  key={director.id}
                  person={director}
                  rank={index + 1}
                  server={server}
                  serverId={serverId}
                  delay={0.1 + index * 0.05}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
