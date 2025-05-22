"use client";

import { Server } from "@/lib/db";
import { preferredServerIdAtom, serverOrderAtom } from "@/lib/atoms/serverAtom";
import { useAtom } from "jotai";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Button } from "./ui/button";
import { Star, StarOff } from "lucide-react";
import { Badge } from "./ui/badge";

interface ServerManagementProps {
  servers: Server[];
}

export const ServerManagement: React.FC<ServerManagementProps> = ({
  servers,
}) => {
  const [preferredServerId, setPreferredServerId] = useAtom(
    preferredServerIdAtom
  );
  const [serverOrder] = useAtom(serverOrderAtom);

  const handleSetPreferred = (serverId: number) => {
    setPreferredServerId(serverId);
  };

  const handleRemovePreferred = () => {
    setPreferredServerId(null);
  };

  // Get ordered servers for display
  const orderedServers =
    serverOrder.length > 0
      ? serverOrder
          .map((id) => servers.find((s) => s.id === id))
          .filter((server): server is NonNullable<typeof server> =>
            Boolean(server)
          )
      : servers;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server Management</CardTitle>
        <CardDescription>
          Manage your server preferences. Set a preferred server to
          automatically connect to it when you open the application.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {orderedServers.map((server) => (
            <div
              key={server.id}
              className="flex items-center gap-3 p-3 border rounded-lg bg-card"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{server.name}</span>
                  {preferredServerId === server.id && (
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <Star className="size-3 fill-yellow-400 text-yellow-400" />
                      Preferred
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{server.url}</p>
              </div>

              <div className="flex items-center gap-2">
                {preferredServerId === server.id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemovePreferred()}
                  >
                    <StarOff className="size-4 mr-2" />
                    Remove Preferred
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetPreferred(server.id)}
                  >
                    <Star className="size-4 mr-2" />
                    Set as Preferred
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
