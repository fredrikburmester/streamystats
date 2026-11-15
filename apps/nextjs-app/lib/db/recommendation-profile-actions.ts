"use server";

import "server-only";

import { db } from "@streamystats/database";
import {
  type TasteTheme,
  userRecommendationProfiles,
} from "@streamystats/database/schema";
import { z } from "zod/v4";
import { embedTextForServer } from "@/lib/ai/embed-text";
import { getSession } from "@/lib/session";
import {
  getRecommendationProfile,
  type RecommendationProfile,
} from "./recommendation-profile";
import { parseThemes } from "./recommendation-profile-pick";
import { revalidateSeriesRecommendations } from "./similar-series-statistics";
import { revalidateRecommendations } from "./similar-statistics";

export type EditableRecommendationProfile = Pick<
  RecommendationProfile,
  "likesText" | "dislikesText" | "useWatchHistory" | "excludeStarted"
>;

/**
 * Resolve whose profile to touch. Users manage their own; admins can manage
 * anyone's on their server, so users who never sign in to Streamystats can
 * still be given a profile.
 */
async function resolveTarget(
  serverId: number,
  userId?: string,
): Promise<string | null> {
  const session = await getSession();
  if (!session || session.serverId !== serverId) return null;
  const target = userId ?? session.id;
  if (target !== session.id && !session.isAdmin) return null;
  return target;
}

/** A user's profile: their own, or anyone's on the server for admins. */
export async function getRecommendationProfileForEdit(
  serverId: number,
  userId?: string,
): Promise<EditableRecommendationProfile | null> {
  const target = await resolveTarget(serverId, userId);
  if (!target) return null;
  const profile = await getRecommendationProfile({ serverId, userId: target });
  return {
    likesText: profile.likesText,
    dislikesText: profile.dislikesText,
    useWatchHistory: profile.useWatchHistory,
    excludeStarted: profile.excludeStarted,
  };
}

const inputSchema = z.object({
  likesText: z.string().max(1000),
  dislikesText: z.string().max(1000),
  useWatchHistory: z.boolean(),
  excludeStarted: z.boolean(),
});

/**
 * Embed each theme with the server's embedding model, reusing embeddings for
 * themes that have not changed. Themes that cannot be embedded are skipped.
 */
async function embedThemes(
  serverId: number,
  text: string,
  previous: TasteTheme[],
): Promise<{ themes: TasteTheme[]; failed: number }> {
  const known = new Map(previous.map((theme) => [theme.text, theme.embedding]));
  const themes: TasteTheme[] = [];
  let failed = 0;
  for (const theme of parseThemes(text)) {
    const cached = known.get(theme);
    if (cached && cached.length > 0) {
      themes.push({ text: theme, embedding: cached });
      continue;
    }
    const result = await embedTextForServer({ serverId, text: theme });
    if (result.ok) themes.push({ text: theme, embedding: result.embedding });
    else failed++;
  }
  return { themes, failed };
}

/** Save a profile: users their own, admins anyone's on their server. */
export async function saveRecommendationProfile(
  serverId: number,
  input: EditableRecommendationProfile,
  userId?: string,
): Promise<{ success: boolean; message: string }> {
  const target = await resolveTarget(serverId, userId);
  if (!target) {
    return {
      success: false,
      message: "You can only edit your own recommendation preferences",
    };
  }
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Invalid input" };

  const previous = await getRecommendationProfile({ serverId, userId: target });
  const likes = await embedThemes(
    serverId,
    parsed.data.likesText,
    previous.likeThemes,
  );
  const dislikes = await embedThemes(
    serverId,
    parsed.data.dislikesText,
    previous.dislikeThemes,
  );

  const values = {
    likesText: parsed.data.likesText,
    dislikesText: parsed.data.dislikesText,
    likeThemes: likes.themes,
    dislikeThemes: dislikes.themes,
    useWatchHistory: parsed.data.useWatchHistory,
    excludeStarted: parsed.data.excludeStarted,
    updatedAt: new Date(),
  };
  await db
    .insert(userRecommendationProfiles)
    .values({ serverId, userId: target, ...values })
    .onConflictDoUpdate({
      target: [
        userRecommendationProfiles.serverId,
        userRecommendationProfiles.userId,
      ],
      set: values,
    });

  await revalidateRecommendations(serverId, target);
  await revalidateSeriesRecommendations(serverId, target);

  const failed = likes.failed + dislikes.failed;
  return failed > 0
    ? {
        success: true,
        message: `Saved, but ${failed} theme(s) could not be embedded. Check the embedding settings.`,
      }
    : { success: true, message: "Recommendation preferences saved" };
}
