"use server";

import { cookies } from "next/headers";

export async function getServerId(): Promise<string | null> {
  const cookieStore = cookies();
  const serverId = cookieStore.get("server_id")?.value;
  return serverId || null;
} 