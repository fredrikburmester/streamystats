"use client";

import type { User } from "@/lib/types";
import { ChatDialog } from "./ChatDialog";

interface ChatDialogWrapperProps {
  chatConfigured: boolean;
  me?: User;
  server?: { url: string; internalUrl?: string | null };
}

export function ChatDialogWrapper({
  chatConfigured,
  me,
  server,
}: ChatDialogWrapperProps) {
  return <ChatDialog chatConfigured={chatConfigured} me={me} server={server} />;
}
