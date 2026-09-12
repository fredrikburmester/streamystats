"use client";

import { Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { User } from "@/lib/types";

const ChatDialog = dynamic(
  () => import("./ChatDialog").then((mod) => mod.ChatDialog),
  {
    ssr: false,
    loading: () => null,
  },
);

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
  const [open, setOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={() => {
          setHasOpened(true);
          setOpen(true);
        }}
        aria-label="Open AI Assistant"
      >
        <Sparkles className="h-4 w-4" />
      </Button>

      {hasOpened && (
        <ChatDialog
          chatConfigured={chatConfigured}
          me={me}
          server={server}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
