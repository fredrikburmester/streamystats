"use server";

import { cookies } from "next/headers";
import { User } from "./db";
import { getToken } from "./token";

export type UserMe = {
  id?: string;
  name?: string;
  serverId?: number;
};

export const getMe = async (): Promise<UserMe | null> => {
  const c = cookies();
  const userStr = c.get("streamystats-user");
  const user = userStr?.value ? JSON.parse(userStr.value) : undefined;

  return user ? (user as UserMe) : null;
};

export const isUserAdmin = async (): Promise<boolean> => {
  const me = await getMe();

  if (!me) {
    return false;
  }

  try {
    const user: User = await fetch(
      `${process.env.API_URL}/servers/${me.serverId}/users/${me.id}`,
      {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${await getToken()}`,
          "Content-Type": "application/json",
        },
      }
    )
      .then((res) => res.json())
      .then((res) => res.data);

    return user && user.is_administrator === true;
  } catch (e) {
    console.error("Failed to check if user is admin", e);
    return false;
  }
};
