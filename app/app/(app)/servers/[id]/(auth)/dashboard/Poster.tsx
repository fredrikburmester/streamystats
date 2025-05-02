"use client";

import { Item, Server } from "@/lib/db";
import { Film, Tv } from "lucide-react";
import Image from "next/image";
import { memo, useEffect, useMemo, useState } from "react";
import { Blurhash } from "react-blurhash";

// Define the possible image types that can be requested
export type ImageType = "Primary" | "Backdrop" | "Thumb" | "Logo";

/**
 * Utility function to calculate aspect ratio and dimensions for different media types
 *
 * Aspect ratios are determined by both the media type and image type:
 * - Movies with Primary/Logo images: 2:3 (portrait)
 * - Episodes, Backdrops, and Thumbs: 16:9 (landscape)
 * - Other cases: 1:1 (square)
 *
 * @param type The type of image being requested
 * @param isEpisode Whether the item is an episode
 * @returns Object containing blurhash dimensions and CSS aspect ratio
 */
const getImageDimensions = (type: ImageType, isEpisode: boolean) => {
  const x = 32;
  let y: number | undefined;
  let aspectRatio: string | undefined;

  if ((!isEpisode && type === "Primary") || (type === "Logo" && !isEpisode)) {
    y = Math.round(x * (3 / 2));
    aspectRatio = "2/3";
  } else if (type === "Backdrop" || type === "Thumb" || isEpisode) {
    y = Math.round(x * (9 / 16));
    aspectRatio = "16/9";
  } else {
    y = x;
    aspectRatio = "1/1";
  }

  return { blurhashX: x, blurhashY: y, aspectRatio };
};

const PosterComponent = ({
  item,
  server,
  width = 500,
  height = 500,
  className = "",
  preferredImageType = "Primary",
  size = "default",
}: {
  item: Item;
  server: Server;
  width?: number;
  height?: number;
  className?: string;
  preferredImageType?: ImageType;
  size?: "default" | "large";
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [blurHash, setBlurHash] = useState<string | null>(null);

  const isEpisode = item.type === "Episode";
  const { blurhashX, blurhashY, aspectRatio } = getImageDimensions(
    preferredImageType,
    isEpisode
  );
  const containerClassName = `relative ${
    size === "large" ? "w-24" : "w-16"
  } ${className} overflow-hidden rounded-md bg-muted`;

  // Memoize the image URL calculation
  const imageUrl = useMemo(() => {
    if (!item.jellyfin_id) return null;

    // Function to get URL for a specific image type
    const getImageUrlByType = (type: ImageType): string | null => {
      switch (type) {
        case "Primary":
          if (item.primary_image_tag) {
            return `${server.url}/Items/${item.jellyfin_id}/Images/Primary?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item.primary_image_tag}`;
          }
          if (isEpisode && item.series_id && item.series_primary_image_tag) {
            return `${server.url}/Items/${item.series_id}/Images/Primary?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item.series_primary_image_tag}`;
          }
          return null;

        case "Backdrop":
          if (item.backdrop_image_tags && item.backdrop_image_tags.length > 0) {
            return `${server.url}/Items/${item.jellyfin_id}/Images/Backdrop?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item.backdrop_image_tags[0]}`;
          }
          if (
            isEpisode &&
            item.parent_backdrop_item_id &&
            item.parent_backdrop_image_tags &&
            item.parent_backdrop_image_tags.length > 0
          ) {
            return `${server.url}/Items/${item.parent_backdrop_item_id}/Images/Backdrop?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item.parent_backdrop_image_tags[0]}`;
          }
          return null;

        case "Thumb":
          if (item?.primary_image_thumb_tag) {
            return `${server.url}/Items/${item?.jellyfin_id}/Images/Thumb?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item?.primary_image_thumb_tag}`;
          }
          if (
            isEpisode &&
            item?.parent_thumb_item_id &&
            item?.parent_thumb_image_tag
          ) {
            return `${server.url}/Items/${item?.parent_thumb_item_id}/Images/Thumb?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item?.parent_thumb_image_tag}`;
          }
          return null;

        case "Logo":
          if (item?.primary_image_logo_tag) {
            return `${server.url}/Items/${item?.jellyfin_id}/Images/Logo?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item?.primary_image_logo_tag}`;
          }
          return null;

        default:
          return null;
      }
    };

    // Try the preferred image type first
    let url = getImageUrlByType(preferredImageType);

    // If preferred image type doesn't exist, fall back to other types in priority order
    if (!url && preferredImageType !== "Primary")
      url = getImageUrlByType("Primary");
    if (!url && preferredImageType !== "Backdrop")
      url = getImageUrlByType("Backdrop");
    if (!url && preferredImageType !== "Thumb")
      url = getImageUrlByType("Thumb");
    if (!url && preferredImageType !== "Logo") url = getImageUrlByType("Logo");

    return url;
  }, [
    item.jellyfin_id,
    item.primary_image_tag,
    item.backdrop_image_tags,
    item.series_id,
    item.series_primary_image_tag,
    item.parent_backdrop_item_id,
    item.parent_backdrop_image_tags,
    item?.parent_thumb_item_id,
    item?.parent_thumb_image_tag,
    item?.primary_image_logo_tag,
    item?.primary_image_thumb_tag,
    isEpisode,
    server.url,
    height,
    width,
    preferredImageType,
  ]);

  // Get blur hash for loading state
  useEffect(() => {
    if (item.image_blur_hashes) {
      // Try to parse image_blur_hashes if it's a string
      const blurHashes = item.image_blur_hashes;

      // Try to get blur hash for the preferred image type
      if (
        preferredImageType === "Primary" &&
        blurHashes.Primary &&
        item.primary_image_tag
      ) {
        setBlurHash(blurHashes.Primary[item.primary_image_tag]);
      } else if (
        preferredImageType === "Primary" &&
        isEpisode &&
        blurHashes.Primary &&
        item.series_primary_image_tag
      ) {
        setBlurHash(blurHashes.Primary[item.series_primary_image_tag]);
      } else if (
        preferredImageType === "Backdrop" &&
        blurHashes.Backdrop &&
        item.backdrop_image_tags &&
        item.backdrop_image_tags.length > 0
      ) {
        setBlurHash(blurHashes.Backdrop[item.backdrop_image_tags[0]]);
      } else if (
        preferredImageType === "Backdrop" &&
        isEpisode &&
        blurHashes.Backdrop &&
        item.parent_backdrop_image_tags &&
        item.parent_backdrop_image_tags.length > 0
      ) {
        setBlurHash(blurHashes.Backdrop[item.parent_backdrop_image_tags[0]]);
      } else if (
        preferredImageType === "Thumb" &&
        blurHashes.Thumb &&
        item.primary_image_thumb_tag
      ) {
        setBlurHash(blurHashes.Thumb[item.primary_image_thumb_tag]);
      } else if (
        preferredImageType === "Thumb" &&
        isEpisode &&
        blurHashes.Thumb &&
        item.parent_thumb_image_tag
      ) {
        setBlurHash(blurHashes.Thumb[item.parent_thumb_image_tag]);
      } else if (
        preferredImageType === "Logo" &&
        blurHashes.Logo &&
        item.primary_image_logo_tag
      ) {
        setBlurHash(blurHashes.Logo[item.primary_image_logo_tag]);
      }
      // Fallbacks if preferred type's blur hash isn't available
      else if (blurHashes.Primary && item.primary_image_tag) {
        setBlurHash(blurHashes.Primary[item.primary_image_tag]);
      } else if (
        isEpisode &&
        blurHashes.Primary &&
        item.series_primary_image_tag
      ) {
        setBlurHash(blurHashes.Primary[item.series_primary_image_tag]);
      } else if (
        blurHashes.Backdrop &&
        item.backdrop_image_tags &&
        item.backdrop_image_tags.length > 0
      ) {
        setBlurHash(blurHashes.Backdrop[item.backdrop_image_tags[0]]);
      } else if (
        isEpisode &&
        blurHashes.Backdrop &&
        item.parent_backdrop_image_tags &&
        item.parent_backdrop_image_tags.length > 0
      ) {
        setBlurHash(blurHashes.Backdrop[item.parent_backdrop_image_tags[0]]);
      } else if (blurHashes.Thumb && Object.keys(blurHashes.Thumb).length > 0) {
        const thumbTag = Object.keys(blurHashes.Thumb)[0];
        setBlurHash(blurHashes.Thumb[thumbTag]);
      } else if (isEpisode && blurHashes.Thumb && item.parent_thumb_image_tag) {
        setBlurHash(blurHashes.Thumb[item.parent_thumb_image_tag]);
      }
    }
  }, [
    item.image_blur_hashes,
    item.primary_image_tag,
    item.series_primary_image_tag,
    item.backdrop_image_tags,
    item.parent_backdrop_image_tags,
    item.parent_thumb_image_tag,
    item.primary_image_logo_tag,
    item.primary_image_thumb_tag,
    isEpisode,
    preferredImageType,
  ]);

  // Early return if no image or error
  if (!imageUrl || hasError) {
    return (
      <div className={containerClassName} style={{ aspectRatio }}>
        <div className="w-full h-full bg-muted flex flex-col items-center justify-center rounded-md">
          <div className="flex flex-col items-center gap-1">
            {item.type === "Movie" ? (
              <Film className="h-4 w-4 text-muted-foreground/70" />
            ) : (
              <Tv className="h-4 w-4 text-muted-foreground/70" />
            )}
            <span className="text-[10px] text-muted-foreground/70">
              {hasError ? "Removed" : "No Image"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerClassName} style={{ aspectRatio }}>
      {blurHash && isLoading && (
        <Blurhash
          hash={blurHash}
          width={blurhashX}
          height={blurhashY}
          resolutionX={32}
          resolutionY={32}
          punch={1}
        />
      )}
      <Image
        src={imageUrl}
        alt={`${item.name} poster`}
        width={width}
        height={height}
        className={`object-cover transition-opacity duration-300 ${
          isLoading ? "opacity-0" : "opacity-100"
        }`}
        onLoad={() => setIsLoading(false)}
        onError={(e) => {
          console.error(`Error loading poster image: ${imageUrl}`, e);
          setHasError(true);
        }}
      />
    </div>
  );
};

// Memoize the entire component to prevent unnecessary re-renders
export const Poster = memo(PosterComponent, (prevProps, nextProps) => {
  // Deep comparison of essential item properties
  return (
    prevProps.item.jellyfin_id === nextProps.item.jellyfin_id &&
    prevProps.item.primary_image_tag === nextProps.item.primary_image_tag &&
    prevProps.item.image_blur_hashes === nextProps.item.image_blur_hashes &&
    prevProps.server.url === nextProps.server.url &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.className === nextProps.className &&
    prevProps.preferredImageType === nextProps.preferredImageType &&
    prevProps.size === nextProps.size
  );
});
