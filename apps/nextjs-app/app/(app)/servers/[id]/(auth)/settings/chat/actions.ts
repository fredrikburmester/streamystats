"use server";

import {
  type ChatAIConfig,
  type ChatProvider,
  clearChatConfig as clearChatConfigDb,
  saveChatConfig as saveChatConfigDb,
  testChatConnection as testChatConnectionDb,
} from "@/lib/db/server";
import { isUserAdmin } from "@/lib/db/users";

export type { ChatAIConfig, ChatProvider };

export async function saveChatConfigAction(
  serverId: number,
  config: ChatAIConfig,
) {
  const isAdmin = await isUserAdmin(serverId);
  if (!isAdmin) {
    throw new Error("Admin privileges required");
  }
  return await saveChatConfigDb({ serverId, config });
}

export async function clearChatConfigAction(serverId: number) {
  const isAdmin = await isUserAdmin(serverId);
  if (!isAdmin) {
    throw new Error("Admin privileges required");
  }
  return await clearChatConfigDb({ serverId });
}

export async function testChatConnectionAction(
  serverId: number,
  config: ChatAIConfig,
): Promise<{ success: boolean; message: string }> {
  const isAdmin = await isUserAdmin(serverId);
  if (!isAdmin) {
    throw new Error("Admin privileges required");
  }
  return await testChatConnectionDb({ config });
}
