"use client";

import { JellyseerrPopularMovie } from "@/lib/db/jellyseerr-items";
import { Film, Tv } from "lucide-react";
import Image from "next/image";
import { memo, useState } from "react";

// TMDB image base URL (w500 is a good size for posters)
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

const JellyseerrPosterComponent = ({
  movie,
  width = 240,
  height = 360,
  className = "",
  size = "default",
}: {
  movie: JellyseerrPopularMovie;
  width?: number;
  height?: number;
  className?: string;
  size?: "default" | "large";
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const aspectRatio = "2/3"; // Standard movie poster aspect ratio
  const containerClassName = `relative ${
    size === "large" ? "w-24" : "w-16"
  } ${className} overflow-hidden rounded-md bg-muted`;

  // Generate TMDB image URL
  const imageUrl = movie.posterPath
    ? `${TMDB_IMAGE_BASE_URL}${movie.posterPath}`
    : movie.backdropPath
    ? `${TMDB_IMAGE_BASE_URL}${movie.backdropPath}`
    : null;

  // Early return if no image or error
  if (!imageUrl || hasError) {
    return (
      <div className={containerClassName} style={{ aspectRatio }}>
        <div className="w-full h-full bg-muted flex flex-col items-center justify-center rounded-md">
          <div className="flex flex-col items-center gap-1">
            {movie.type === "Movie" ? (
              <Film className="h-4 w-4 text-muted-foreground/70" />
            ) : (
              <Tv className="h-4 w-4 text-muted-foreground/70" />
            )}
            <span className="text-[10px] text-muted-foreground/70">
              {hasError ? "Error" : "No Image"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName} style={{ aspectRatio }}>
      <Image
        src={imageUrl}
        alt={`${movie.title} poster`}
        width={width}
        height={height}
        className={`object-cover transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        onLoad={() => setIsLoading(false)}
        onError={(e) => {
          console.error(
            `Error loading Jellyseerr poster image: ${imageUrl}`,
            e
          );
          setHasError(true);
        }}
      />
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const JellyseerrPoster = memo(
  JellyseerrPosterComponent,
  (prevProps, nextProps) => {
    return (
      prevProps.movie.id === nextProps.movie.id &&
      prevProps.movie.posterPath === nextProps.movie.posterPath &&
      prevProps.movie.backdropPath === nextProps.movie.backdropPath &&
      prevProps.width === nextProps.width &&
      prevProps.height === nextProps.height &&
      prevProps.className === nextProps.className &&
      prevProps.size === nextProps.size
    );
  }
);
