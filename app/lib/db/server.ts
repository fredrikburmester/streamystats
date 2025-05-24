"use server";

import { getToken } from "../token";
import { revalidatePath } from "next/cache";

export const saveOpenAIKey = async (
  serverId: string | number,
  apiKey: string
) => {
  try {
    const response = await fetch(
      `${process.env.API_URL}/admin/servers/${serverId}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ open_ai_api_token: apiKey }),
      }
    );
    if (!response.ok) {
      throw new Error("Failed to save OpenAI API key");
    }
    revalidatePath(`/servers/${serverId}/settings`);
  } catch (error) {
    console.error("Error saving OpenAI API key:", error);
    throw error;
  }
};

export const saveOllamaConfig = async (
  serverId: string | number,
  config: {
    ollama_api_token?: string;
    ollama_base_url?: string;
    ollama_model?: string;
  }
) => {
  try {
    const response = await fetch(
      `${process.env.API_URL}/admin/servers/${serverId}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify(config),
      }
    );
    if (!response.ok) {
      throw new Error("Failed to save Ollama configuration");
    }
    revalidatePath(`/servers/${serverId}/settings`);
  } catch (error) {
    console.error("Error saving Ollama configuration:", error);
    throw error;
  }
};

export const saveEmbeddingProvider = async (
  serverId: string | number,
  provider: "openai" | "ollama"
) => {
  try {
    const response = await fetch(
      `${process.env.API_URL}/admin/servers/${serverId}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ embedding_provider: provider }),
      }
    );
    if (!response.ok) {
      throw new Error("Failed to save embedding provider");
    }
    revalidatePath(`/servers/${serverId}/settings`);
  } catch (error) {
    console.error("Error saving embedding provider:", error);
    throw error;
  }
};

export interface EmbeddingProgress {
  total: number;
  processed: number;
  status:
    | "idle"
    | "starting"
    | "processing"
    | "completed"
    | "failed"
    | "stopped";
  percentage: number;
}

export const getEmbeddingProgress = async (
  serverId: string | number
): Promise<EmbeddingProgress> => {
  try {
    const response = await fetch(
      `${process.env.API_URL}/admin/servers/${serverId}/embedding/progress`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getToken()}`,
        },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        "Failed to fetch embedding progress:",
        response.status,
        response.statusText
      );
      throw new Error("Failed to fetch embedding progress");
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error("Error fetching embedding progress:", error);
    // Return default values on error
    return {
      total: 0,
      processed: 0,
      status: "idle",
      percentage: 0,
    };
  }
};

export const startEmbedding = async (
  serverId: string | number
): Promise<{ message: string }> => {
  try {
    const response = await fetch(
      `${process.env.API_URL}/admin/servers/${serverId}/embedding/start`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getToken()}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to start embedding process");
    }

    return response.json();
  } catch (error) {
    console.error("Error starting embedding process:", error);
    throw error;
  }
};

export const stopEmbedding = async (
  serverId: string | number
): Promise<{ message: string }> => {
  try {
    const response = await fetch(
      `${process.env.API_URL}/admin/servers/${serverId}/embedding/stop`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getToken()}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to stop embedding process");
    }

    return response.json();
  } catch (error) {
    console.error("Error stopping embedding process:", error);
    throw error;
  }
};

export async function clearEmbeddings(
  serverId: number
): Promise<{ message: string }> {
  const response = await fetch(
    `${process.env.API_URL}/admin/servers/${serverId}/clear-embeddings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${await getToken()}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to clear embeddings");
  }

  revalidatePath(`/servers/${serverId}/settings`);
  return response.json();
}

export const toggleAutoEmbeddings = async (
  serverId: string | number,
  enabled: boolean
) => {
  try {
    const response = await fetch(
      `${process.env.API_URL}/admin/servers/${serverId}/settings`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getToken()}`,
        },
        body: JSON.stringify({ auto_generate_embeddings: enabled }),
      }
    );
    if (!response.ok) {
      throw new Error("Failed to update auto-embedding setting");
    }
    revalidatePath(`/servers/${serverId}/settings`);
  } catch (error) {
    console.error("Error updating auto-embedding setting:", error);
    throw error;
  }
};
