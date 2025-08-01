"use client";

import { Badge } from "@/components/ui/badge";
import type { User } from "@/lib/types";
import React from "react";

interface UserBadgesProps {
  user: User;
}

const UserBadges: React.FC<UserBadgesProps> = ({ user }) => {
  return (
    <div className="flex flex-col md:flex-row items-center gap-2">
      <Badge
        className="self-start max-w-[90vw] cursor-pointer"
        variant="secondary"
        onClick={() => {
          navigator.clipboard
            .writeText(user.id || "")
            .then(() => {
              alert("Jellyfin ID copied to clipboard!");
            })
            .catch((err) => {
              console.error("Failed to copy: ", err);
            });
        }}
      >
        <p className="truncate">Jellyfin ID: {user.id}</p>
      </Badge>
    </div>
  );
};

export default UserBadges;
