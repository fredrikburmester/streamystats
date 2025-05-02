"use server";

import { getToken } from "../token";

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
  } catch (error) {
    console.error("Error saving OpenAI API key:", error);
    throw error;
  }
};
