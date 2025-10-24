"use client";

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useRouter } from "next/navigation";

interface UpdateConnectionProps {
  serverId: number;
}

export function UpdateConnection({ serverId }: UpdateConnectionProps) {
  const router = useRouter();

  const handleUpdateConnection = () => {
    router.push(`/servers/${serverId}/reconnect`);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Server Connection</CardTitle>
        <CardDescription>
          Update the server URL, API key, or other connection settings
        </CardDescription>
        <div className="pt-4">
          <Button onClick={handleUpdateConnection} variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Update Connection Settings
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}

