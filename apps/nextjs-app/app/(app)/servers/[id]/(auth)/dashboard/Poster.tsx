"use client";

import { Film, Tv } from "lucide-react";
import Image from "next/image";
import { memo, useEffect, useMemo, useState } from "react";
import { Blurhash } from "react-blurhash";
import { getInternalUrl } from "@/lib/server-url";
import type { ServerPublic } from "@/lib/types";
import type { RecommendationCardItem } from "./recommendation-types";

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
 * @returns Object containing CSS aspect ratio
 */
const getImageDimensions = (type: ImageType, isEpisode: boolean) => {
  let aspectRatio: string | undefined;

  if ((!isEpisode && type === "Primary") || (type === "Logo" && !isEpisode)) {
    aspectRatio = "0.71";
  } else if (type === "Backdrop" || type === "Thumb" || isEpisode) {
    aspectRatio = "16/9";
  } else {
    aspectRatio = "1/1";
  }

  return { aspectRatio };
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
  item: RecommendationCardItem;
  server: ServerPublic;
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
  const { aspectRatio } = getImageDimensions(preferredImageType, isEpisode);
  const containerClassName = `relative ${
    size === "large" ? "w-24" : "w-16"
  } ${className} overflow-hidden rounded-md bg-muted`;

  // Memoize the image URL calculation
  const imageUrl = useMemo(() => {
    if (!item.id) {
      return null;
    }

    // Function to get URL for a specific image type
    const getImageUrlByType = (type: ImageType): string | null => {
      switch (type) {
        case "Primary":
          if (item.primaryImageTag) {
            return `${getInternalUrl(server)}/Items/${item.id}/Images/Primary?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item.primaryImageTag}`;
          }
          if (isEpisode && item.seriesId && item.seriesPrimaryImageTag) {
            return `${getInternalUrl(server)}/Items/${item.seriesId}/Images/Primary?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item.seriesPrimaryImageTag}`;
          }
          return null;

        case "Backdrop":
          if (item.backdropImageTags && item.backdropImageTags.length > 0) {
            return `${getInternalUrl(server)}/Items/${item.id}/Images/Backdrop?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item.backdropImageTags[0]}`;
          }
          if (
            isEpisode &&
            item.parentBackdropItemId &&
            item.parentBackdropImageTags &&
            item.parentBackdropImageTags.length > 0
          ) {
            return `${getInternalUrl(server)}/Items/${item.parentBackdropItemId}/Images/Backdrop?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item.parentBackdropImageTags[0]}`;
          }
          return null;

        case "Thumb":
          if (item?.primaryImageThumbTag) {
            return `${getInternalUrl(server)}/Items/${item?.id}/Images/Thumb?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item?.primaryImageThumbTag}`;
          }
          if (
            isEpisode &&
            item?.parentThumbItemId &&
            item?.parentThumbImageTag
          ) {
            return `${getInternalUrl(server)}/Items/${item?.parentThumbItemId}/Images/Thumb?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item?.parentThumbImageTag}`;
          }
          return null;

        case "Logo":
          if (item?.primaryImageLogoTag) {
            return `${getInternalUrl(server)}/Items/${item?.id}/Images/Logo?fillHeight=${height}&fillWidth=${width}&quality=96&tag=${item?.primaryImageLogoTag}`;
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
    item.id,
    item.primaryImageTag,
    item.backdropImageTags,
    item.seriesId,
    item.seriesPrimaryImageTag,
    item.parentBackdropItemId,
    item.parentBackdropImageTags,
    item?.parentThumbItemId,
    item?.parentThumbImageTag,
    item?.primaryImageLogoTag,
    item?.primaryImageThumbTag,
    isEpisode,
    server.url,
    height,
    width,
    preferredImageType,
  ]);

  // Get blur hash for loading state
  useEffect(() => {
    if (item.imageBlurHashes) {
      const blurHashes = item.imageBlurHashes;

      // Try to get blur hash for the preferred image type
      if (
        preferredImageType === "Primary" &&
        blurHashes.Primary &&
        item.primaryImageTag
      ) {
        setBlurHash(blurHashes.Primary[item.primaryImageTag]);
      } else if (
        preferredImageType === "Primary" &&
        isEpisode &&
        blurHashes.Primary &&
        item.seriesPrimaryImageTag
      ) {
        setBlurHash(blurHashes.Primary[item.seriesPrimaryImageTag]);
      } else if (
        preferredImageType === "Backdrop" &&
        blurHashes.Backdrop &&
        item.backdropImageTags &&
        item.backdropImageTags.length > 0
      ) {
        setBlurHash(blurHashes.Backdrop[item.backdropImageTags[0]]);
      } else if (
        preferredImageType === "Backdrop" &&
        isEpisode &&
        blurHashes.Backdrop &&
        item.parentBackdropImageTags &&
        item.parentBackdropImageTags.length > 0
      ) {
        setBlurHash(blurHashes.Backdrop[item.parentBackdropImageTags[0]]);
      } else if (
        preferredImageType === "Thumb" &&
        blurHashes.Thumb &&
        item.primaryImageThumbTag
      ) {
        setBlurHash(blurHashes.Thumb[item.primaryImageThumbTag]);
      } else if (
        preferredImageType === "Thumb" &&
        isEpisode &&
        blurHashes.Thumb &&
        item.parentThumbImageTag
      ) {
        setBlurHash(blurHashes.Thumb[item.parentThumbImageTag]);
      } else if (
        preferredImageType === "Logo" &&
        blurHashes.Logo &&
        item.primaryImageLogoTag
      ) {
        setBlurHash(blurHashes.Logo[item.primaryImageLogoTag]);
      }
      // Fallbacks if preferred type's blur hash isn't available
      else if (blurHashes.Primary && item.primaryImageTag) {
        setBlurHash(blurHashes.Primary[item.primaryImageTag]);
      } else if (
        isEpisode &&
        blurHashes.Primary &&
        item.seriesPrimaryImageTag
      ) {
        setBlurHash(blurHashes.Primary[item.seriesPrimaryImageTag]);
      } else if (
        blurHashes.Backdrop &&
        item.backdropImageTags &&
        item.backdropImageTags.length > 0
      ) {
        setBlurHash(blurHashes.Backdrop[item.backdropImageTags[0]]);
      } else if (
        isEpisode &&
        blurHashes.Backdrop &&
        item.parentBackdropImageTags &&
        item.parentBackdropImageTags.length > 0
      ) {
        setBlurHash(blurHashes.Backdrop[item.parentBackdropImageTags[0]]);
      } else if (blurHashes.Thumb && Object.keys(blurHashes.Thumb).length > 0) {
        const thumbTag = Object.keys(blurHashes.Thumb)[0];
        setBlurHash(blurHashes.Thumb[thumbTag]);
      } else if (isEpisode && blurHashes.Thumb && item.parentThumbImageTag) {
        setBlurHash(blurHashes.Thumb[item.parentThumbImageTag]);
      }
    }
  }, [
    item.imageBlurHashes,
    item.primaryImageTag,
    item.seriesPrimaryImageTag,
    item.backdropImageTags,
    item.parentBackdropImageTags,
    item.parentThumbImageTag,
    item.primaryImageLogoTag,
    item.primaryImageThumbTag,
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
        <div className="absolute inset-0">
          <Blurhash
            hash={blurHash}
            width="100%"
            height="100%"
            resolutionX={32}
            resolutionY={32}
            punch={1}
            style={{ width: "100%", height: "100%" }}
          />
        </div>
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
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.primaryImageTag === nextProps.item.primaryImageTag &&
    prevProps.item.imageBlurHashes === nextProps.item.imageBlurHashes &&
    prevProps.server.url === nextProps.server.url &&
    prevProps.width === nextProps.width &&
    prevProps.height === nextProps.height &&
    prevProps.className === nextProps.className &&
    prevProps.preferredImageType === nextProps.preferredImageType &&
    prevProps.size === nextProps.size
  );
});
