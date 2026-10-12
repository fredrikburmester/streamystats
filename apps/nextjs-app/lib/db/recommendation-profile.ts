import "server-only";

import { db } from "@streamystats/database";
import {
  type TasteTheme,
  userRecommendationProfiles,
} from "@streamystats/database/schema";
import { and, eq } from "drizzle-orm";

import { themeSeedCard } from "./recommendation-profile-pick";

export interface RecommendationProfile {
  likesText: string;
  dislikesText: string;
  likeThemes: TasteTheme[];
  dislikeThemes: TasteTheme[];
  useWatchHistory: boolean;
  excludeStarted: boolean;
}

export const DEFAULT_RECOMMENDATION_PROFILE: RecommendationProfile = {
  likesText: "",
  dislikesText: "",
  likeThemes: [],
  dislikeThemes: [],
  useWatchHistory: true,
  excludeStarted: false,
};

/** A user's taste profile, or the defaults (history on, nothing excluded). */
export async function getRecommendationProfile({
  serverId,
  userId,
}: {
  serverId: number;
  userId: string;
}): Promise<RecommendationProfile> {
  const rows = await db
    .select()
    .from(userRecommendationProfiles)
    .where(
      and(
        eq(userRecommendationProfiles.serverId, serverId),
        eq(userRecommendationProfiles.userId, userId),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return DEFAULT_RECOMMENDATION_PROFILE;
  return {
    likesText: row.likesText,
    dislikesText: row.dislikesText,
    likeThemes: row.likeThemes,
    dislikeThemes: row.dislikeThemes,
    useWatchHistory: row.useWatchHistory,
    excludeStarted: row.excludeStarted,
  };
}

/** Like-themes as recommendation seeds, in the order the user wrote them. */
export function getThemeSeedCards(profile: RecommendationProfile) {
  return profile.likeThemes
    .filter((theme) => theme.embedding.length > 0)
    .map((theme, index) => themeSeedCard(theme, index));
}
