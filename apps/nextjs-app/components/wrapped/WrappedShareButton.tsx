"use client";

import { useState } from "react";
import { Download, Share2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WrappedShareButtonProps {
  serverId: number;
  userId: string;
  year: number;
}

const CARD_TYPES = [
  { id: "summary", label: "Summary Card" },
  { id: "top-content", label: "Top Content" },
  { id: "watch-time", label: "Watch Time" },
  { id: "genres", label: "Top Genres" },
] as const;

export function WrappedShareButton({
  serverId,
  userId,
  year,
}: WrappedShareButtonProps) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const downloadCard = async (cardType: string) => {
    setDownloading(cardType);
    try {
      const response = await fetch(
        `/api/wrapped/${serverId}/${userId}/${year}/${cardType}`
      );
      if (!response.ok) {
        throw new Error("Failed to generate card");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `streamystats-wrapped-${year}-${cardType}.png`;
      link.href = url;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download card:", error);
    } finally {
      setDownloading(null);
    }
  };

  const shareCard = async (cardType: string) => {
    try {
      const response = await fetch(
        `/api/wrapped/${serverId}/${userId}/${year}/${cardType}`
      );
      if (!response.ok) {
        throw new Error("Failed to generate card");
      }
      const blob = await response.blob();
      const file = new File([blob], `wrapped-${year}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `My ${year} Streamystats Wrapped`,
          text: `Check out my ${year} watching stats!`,
          files: [file],
        });
      } else {
        // Fallback to download
        await downloadCard(cardType);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Failed to share:", error);
      }
    }
  };

  const copyLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Share2 className="h-4 w-4" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Download Card</DropdownMenuLabel>
        {CARD_TYPES.map((card) => (
          <DropdownMenuItem
            key={card.id}
            onClick={() => downloadCard(card.id)}
            disabled={downloading !== null}
          >
            {downloading === card.id ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {card.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyLink}>
          {copied ? (
            <Check className="h-4 w-4 mr-2" />
          ) : (
            <Share2 className="h-4 w-4 mr-2" />
          )}
          {copied ? "Copied!" : "Copy Link"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
