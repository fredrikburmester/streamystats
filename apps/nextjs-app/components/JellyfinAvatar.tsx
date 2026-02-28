"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInternalUrl } from "@/lib/server-url";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  user:
    | User
    | { id: string | number; name: string | null; jellyfin_id: string | null };
  server: { url: string; internalUrl?: string | null };
  imageTag?: string;
  quality?: number;
  className?: string;
}

export default function JellyfinAvatar({
  user,
  server,
  imageTag,
  quality = 90,
  className,
}: Props) {
  const [hasError, setHasError] = useState(false);

  const imageUrl = useMemo(() => {
    if (!server || !user?.id) return null;

    return `${getInternalUrl(server)}/Users/${user.id}/Images/Primary?quality=${quality}${
      imageTag ? `&tag=${imageTag}` : ""
    }`;
  }, [server, user?.id, imageTag, quality]);

  const initials = useMemo(() => {
    if (!user?.name) return "?";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [user?.name]);

  if (!server || !user) return null;

  return (
    <Avatar className={cn("h-8 w-8", className)}>
      {imageUrl && !hasError ? (
        <Image
          src={imageUrl}
          alt={user.name || "User"}
          width={64}
          height={64}
          className="aspect-square h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <AvatarFallback>{initials}</AvatarFallback>
      )}
    </Avatar>
  );
}
