"use server";

import { Item } from "../db";
import { getToken } from "../token";

export const getSimilarStatistics = async (
  serverId: number | string
): Promise<Item[]> => {
  try {
    const res = await fetch(
      `${process.env.API_URL}/servers/${serverId}/statistics/recommendations/me`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          "Content-Type": "application/json",
        },
      }
    );
    const data = await res.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching similar statistics:", error);
    return [];
  }
};
