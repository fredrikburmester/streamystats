"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import {
  AlertCircle,
  Bot,
  ExternalLink,
  Film,
  Sparkles,
  Tv,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { getInternalUrl } from "@/lib/server-url";
import type { User } from "@/lib/types";
import JellyfinAvatar from "./JellyfinAvatar";

interface ChatDialogProps {
  chatConfigured: boolean;
  me?: User;
  server?: { url: string; internalUrl?: string | null };
}

interface ChatItemData {
  id: string;
  name: string;
  type?: string;
  year?: number;
  rating?: number;
  primaryImageTag?: string;
  seriesId?: string;
  seriesPrimaryImageTag?: string;
}

interface ItemCardProps {
  item: ChatItemData;
  serverId: string;
  server: { url: string; internalUrl?: string | null };
}

function ItemCard({ item, serverId, server }: ItemCardProps) {
  const [imageError, setImageError] = useState(false);

  const imageUrl = useMemo(() => {
    const baseUrl = getInternalUrl(server);
    if (item.primaryImageTag) {
      return `${baseUrl}/Items/${item.id}/Images/Primary?fillHeight=120&fillWidth=80&quality=96&tag=${item.primaryImageTag}`;
    }
    if (item.seriesId && item.seriesPrimaryImageTag) {
      return `${baseUrl}/Items/${item.seriesId}/Images/Primary?fillHeight=120&fillWidth=80&quality=96&tag=${item.seriesPrimaryImageTag}`;
    }
    // Fallback: try to load image without tag (Jellyfin will return it if it exists)
    return `${baseUrl}/Items/${item.id}/Images/Primary?fillHeight=120&fillWidth=80&quality=96`;
  }, [item, server]);

  const isMovie = item.type === "Movie";
  const Icon = isMovie ? Film : Tv;

  return (
    <Link
      href={`/servers/${serverId}/library/${item.id}`}
      className="inline-flex items-center gap-3 px-3 py-2 rounded-lg bg-card border border-border hover:bg-accent transition-colors group max-w-xs"
    >
      <div className="flex-shrink-0 w-10 h-14 rounded overflow-hidden bg-muted relative">
        {imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt={item.name}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {item.name}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {item.type && (
            <span className="flex items-center gap-1">
              <Icon className="h-3 w-3" />
              {item.type}
            </span>
          )}
          {item.year && (
            <>
              {item.type && <span>•</span>}
              <span>{item.year}</span>
            </>
          )}
          {item.rating && (
            <>
              <span>•</span>
              <span className="text-yellow-500">★</span>
              <span>{item.rating.toFixed(1)}</span>
            </>
          )}
        </div>
      </div>
      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </Link>
  );
}

export function ChatDialog({ chatConfigured, me, server }: ChatDialogProps) {
  const [open, setOpen] = useState(false);
  const params = useParams();
  const serverId = params.id as string;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { serverId },
      }),
    [serverId],
  );

  const { messages, sendMessage, status, error } = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const isLoading = status === "streaming" || status === "submitted";

  const itemsCache = useMemo(() => {
    const cache = new Map<string, ChatItemData>();

    const extractItems = (data: unknown) => {
      if (!data || typeof data !== "object") return;
      const obj = data as Record<string, unknown>;
      const itemArrays = [
        obj.movies,
        obj.series,
        obj.items,
        obj.recommendations,
        obj.similar,
      ];
      for (const arr of itemArrays) {
        if (Array.isArray(arr)) {
          for (const item of arr) {
            const itemData = (item as Record<string, unknown>)?.item || item;
            if (itemData?.id && !cache.has(itemData.id as string)) {
              cache.set(itemData.id as string, {
                id: itemData.id as string,
                name: itemData.name as string,
                type: itemData.type as string | undefined,
                year: (itemData.year || itemData.productionYear) as
                  | number
                  | undefined,
                rating: (itemData.rating || itemData.communityRating) as
                  | number
                  | undefined,
                primaryImageTag: itemData.primaryImageTag as string | undefined,
                seriesId: itemData.seriesId as string | undefined,
                seriesPrimaryImageTag: itemData.seriesPrimaryImageTag as
                  | string
                  | undefined,
              });
            }
          }
        }
      }
      if (
        obj.sourceItem &&
        typeof obj.sourceItem === "object" &&
        (obj.sourceItem as Record<string, unknown>).id &&
        !cache.has((obj.sourceItem as Record<string, unknown>).id as string)
      ) {
        const src = obj.sourceItem as Record<string, unknown>;
        cache.set(src.id as string, {
          id: src.id as string,
          name: src.name as string,
          type: src.type as string | undefined,
          year: (src.year || src.productionYear) as number | undefined,
          rating: (src.rating || src.communityRating) as number | undefined,
          primaryImageTag: src.primaryImageTag as string | undefined,
          seriesId: src.seriesId as string | undefined,
          seriesPrimaryImageTag: src.seriesPrimaryImageTag as
            | string
            | undefined,
        });
      }
    };

    for (const message of messages) {
      for (const part of message.parts) {
        if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
          const toolPart = part as {
            state: string;
            output?: unknown;
          };
          if (toolPart.state === "output-available" && toolPart.output) {
            extractItems(toolPart.output);
          }
        }
      }
    }

    return cache;
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleSubmit = useCallback(
    async (message: { text: string }) => {
      if (!message.text.trim() || isLoading) return;
      await sendMessage({ text: message.text });
    },
    [isLoading, sendMessage],
  );

  const markdownComponents = useMemo(
    () => ({
      a: ({
        href,
        children,
      }: {
        href?: string;
        children?: React.ReactNode;
      }) => {
        if (href?.startsWith("item://")) {
          const itemId = href.replace("item://", "");
          const cachedItem = itemsCache.get(itemId);
          const itemName = typeof children === "string" ? children : "Unknown";

          if (server) {
            return (
              <span className="block my-2">
                <ItemCard
                  item={cachedItem || { id: itemId, name: itemName }}
                  serverId={serverId}
                  server={server}
                />
              </span>
            );
          }

          return (
            <Link
              href={`/servers/${serverId}/library/${itemId}`}
              className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
            >
              {children || "View Item"}
              <ExternalLink className="h-3 w-3" />
            </Link>
          );
        }

        return (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {children}
          </a>
        );
      },
    }),
    [itemsCache, server, serverId],
  );

  const renderMessageText = useCallback(
    (text: string): React.ReactNode => (
      <Streamdown
        components={markdownComponents}
        className="size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      >
        {text}
      </Streamdown>
    ),
    [markdownComponents],
  );

  const isMobile = useIsMobile();

  const handleOpen = useCallback(() => {
    setOpen(true);
  }, []);

  const chatContent = (
    <>
      {!chatConfigured ? (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center space-y-3">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="font-semibold">AI Chat Not Configured</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              To use the AI assistant, configure a chat provider in Settings
              &gt; AI Chat.
            </p>
          </div>
        </div>
      ) : (
        <>
          <Conversation className="flex-1 min-h-0">
            <ConversationContent className="gap-6 px-4 py-4">
              {messages.length === 0 ? (
                <div className="flex size-full flex-col items-center justify-center gap-4 p-8 text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground" />
                  <div className="space-y-2 text-center">
                    <h3 className="font-semibold">
                      Ask me about your media library
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto text-center">
                      Try asking things like:
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center pt-2">
                      {[
                        "What's my most watched movie?",
                        "Recommend something new",
                        "Recently added movies",
                        "Top rated series",
                      ].map((suggestion) => (
                        <Button
                          key={suggestion}
                          variant="outline"
                          size="sm"
                          className="text-xs"
                          onClick={() => handleSubmit({ text: suggestion })}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((message, messageIndex) => {
                  const isLastMessage = messageIndex === messages.length - 1;

                  return (
                    <Message key={message.id} from={message.role}>
                      <div className="flex gap-3">
                        {message.role === "assistant" && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-4 w-4 text-primary" />
                          </div>
                        )}
                        <MessageContent className="flex-1">
                          {message.parts.map((part, partIndex) => {
                            if (part.type === "reasoning") {
                              const reasoningPart = part as {
                                type: "reasoning";
                                text: string;
                                state?: "streaming" | "done";
                              };
                              if (!reasoningPart.text.trim()) return null;
                              return (
                                <Reasoning
                                  key={partIndex}
                                  isStreaming={
                                    reasoningPart.state === "streaming"
                                  }
                                >
                                  <ReasoningTrigger />
                                  <ReasoningContent>
                                    {reasoningPart.text}
                                  </ReasoningContent>
                                </Reasoning>
                              );
                            }
                            if (part.type === "text" && part.text.trim()) {
                              return (
                                <div key={partIndex}>
                                  {renderMessageText(part.text)}
                                </div>
                              );
                            }
                            if (
                              part.type.startsWith("tool-") ||
                              part.type === "dynamic-tool"
                            ) {
                              const toolPart = part as {
                                type: string;
                                toolName?: string;
                                state:
                                  | "input-streaming"
                                  | "input-available"
                                  | "output-available"
                                  | "output-error";
                                toolCallId: string;
                                input?: Record<string, unknown>;
                                output?: unknown;
                                errorText?: string;
                              };
                              const toolName =
                                toolPart.toolName ||
                                part.type.replace("tool-", "");
                              const toolDisplayName = toolName
                                .replace(/([A-Z])/g, " $1")
                                .toLowerCase()
                                .trim();

                              switch (toolPart.state) {
                                case "input-streaming":
                                case "input-available":
                                  return (
                                    <div
                                      key={partIndex}
                                      className="flex items-center gap-2 text-xs text-muted-foreground py-1"
                                    >
                                      <Loader size={12} />
                                      Looking up {toolDisplayName}...
                                    </div>
                                  );
                                case "output-available":
                                  return (
                                    <div
                                      key={partIndex}
                                      className="flex items-center gap-2 text-xs text-muted-foreground py-1"
                                    >
                                      <span className="text-green-500">✓</span>
                                      Found {toolDisplayName} data
                                    </div>
                                  );
                                case "output-error":
                                  return (
                                    <div
                                      key={partIndex}
                                      className="flex items-center gap-2 text-xs text-destructive py-1"
                                    >
                                      <AlertCircle className="h-3 w-3" />
                                      Error: {toolPart.errorText}
                                    </div>
                                  );
                                default:
                                  return null;
                              }
                            }
                            return null;
                          })}
                          {isLoading &&
                            isLastMessage &&
                            message.role === "assistant" &&
                            !message.parts.some(
                              (p) => p.type === "text" && p.text.trim(),
                            ) &&
                            !message.parts.some((p) =>
                              p.type.startsWith("tool-"),
                            ) &&
                            !message.parts.some(
                              (p) => p.type === "reasoning",
                            ) && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                                <Loader size={12} />
                                Thinking...
                              </div>
                            )}
                        </MessageContent>
                        {message.role === "user" && me && server && (
                          <JellyfinAvatar
                            user={me}
                            server={server}
                            className="flex-shrink-0 w-8 h-8"
                          />
                        )}
                      </div>
                    </Message>
                  );
                })
              )}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <Message from="assistant">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <MessageContent>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader size={12} />
                        Thinking...
                      </div>
                    </MessageContent>
                  </div>
                </Message>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {error && (
            <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 shrink-0">
              <p className="text-sm text-destructive">{error.message}</p>
            </div>
          )}

          <div className="p-4 border-t shrink-0">
            <PromptInput onSubmit={handleSubmit} className="rounded-lg border">
              <PromptInputTextarea
                placeholder="Ask about your watch history..."
                disabled={isLoading}
              />
              <PromptInputFooter>
                <div />
                <PromptInputSubmit status={status} disabled={isLoading} />
              </PromptInputFooter>
            </PromptInput>
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        onClick={handleOpen}
      >
        <Sparkles className="h-4 w-4" />
      </Button>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="h-[80vh] max-h-[900px] flex flex-col p-0 gap-0 overflow-hidden">
            <DrawerHeader className="px-4 py-3 border-b shrink-0">
              <DrawerTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Assistant
              </DrawerTitle>
            </DrawerHeader>
            <div className="flex-1 min-h-0 flex flex-col">{chatContent}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl lg:max-w-4xl xl:max-w-5xl h-[80vh] max-h-[900px] flex flex-col p-0 gap-0 overflow-hidden">
            <DialogHeader className="px-4 py-3 border-b shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                AI Assistant
              </DialogTitle>
            </DialogHeader>
            {chatContent}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
