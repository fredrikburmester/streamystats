"use client";

import { Users } from "lucide-react";
import { motion } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import type { PersonStats } from "@/lib/db/wrapped";
import type { ServerPublic } from "@/lib/types";
import { getJellyfinImageUrl } from "@/lib/utils";
import { Highlight, SectionHeader, SubsectionHeader, Tagline } from "./shared";

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
    <section className="relative py-28 px-4 md:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-950/30 via-transparent to-transparent" />

      <div className="max-w-6xl mx-auto relative">
        <SectionHeader
          icon={Users}
          label="Familiar faces"
          title="Most Watched People"
        />

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
              <Highlight>{movieCount} movies</Highlight>
              {episodeCount > 0 && (
                <>
                  {" "}
                  and <Highlight>{episodeCount} episodes</Highlight>
                </>
              )}{" "}
              brought to life by countless talents.{" "}
              <Tagline>The faces that defined your {year}.</Tagline>
            </p>
          </div>
        </motion.div>

        {topActors.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mb-16"
          >
            <SubsectionHeader>Actors</SubsectionHeader>
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
            <SubsectionHeader>Directors</SubsectionHeader>
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
