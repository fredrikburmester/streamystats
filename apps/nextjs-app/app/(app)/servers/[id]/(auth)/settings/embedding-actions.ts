"use server";

import {
  clearEmbeddings as clearEmbeddingsDb,
  type EmbeddingConfig,
  type EmbeddingProgress,
  type EmbeddingProvider,
  getEmbeddingProgress as getEmbeddingProgressDb,
  saveEmbeddingConfig as saveEmbeddingConfigDb,
  startEmbedding as startEmbeddingDb,
  stopEmbedding as stopEmbeddingDb,
  toggleAutoEmbeddings as toggleAutoEmbeddingsDb,
} from "@/lib/db/server";
import { isUserAdmin } from "@/lib/db/users";

export type { EmbeddingConfig, EmbeddingProgress, EmbeddingProvider };

export async function saveEmbeddingConfigAction(
  serverId: number,
  config: EmbeddingConfig,
) {
  const isAdmin = await isUserAdmin(serverId);
  if (!isAdmin) {
    throw new Error("Admin privileges required");
  }
  return await saveEmbeddingConfigDb({ serverId, config });
}

export async function clearEmbeddingsAction(serverId: number) {
  const isAdmin = await isUserAdmin(serverId);
  if (!isAdmin) {
    throw new Error("Admin privileges required");
  }
  return await clearEmbeddingsDb({ serverId });
}

export async function startEmbeddingAction(serverId: number) {
  const isAdmin = await isUserAdmin(serverId);
  if (!isAdmin) {
    throw new Error("Admin privileges required");
  }
  return await startEmbeddingDb({ serverId });
}

export async function stopEmbeddingAction(serverId: number) {
  const isAdmin = await isUserAdmin(serverId);
  if (!isAdmin) {
    throw new Error("Admin privileges required");
  }
  return await stopEmbeddingDb({ serverId });
}

export async function toggleAutoEmbeddingsAction(
  serverId: number,
  enabled: boolean,
) {
  const isAdmin = await isUserAdmin(serverId);
  if (!isAdmin) {
    throw new Error("Admin privileges required");
  }
  return await toggleAutoEmbeddingsDb({ serverId, enabled });
}

export async function getEmbeddingProgressAction(
  serverId: number,
): Promise<EmbeddingProgress> {
  const isAdmin = await isUserAdmin(serverId);
  if (!isAdmin) {
    throw new Error("Admin privileges required");
  }
  return await getEmbeddingProgressDb({ serverId });
}
