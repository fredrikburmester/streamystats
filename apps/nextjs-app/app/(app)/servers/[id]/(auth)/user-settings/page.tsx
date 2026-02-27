"use client";

import { useParams } from "next/navigation";
import { Container } from "@/components/Container";
import { InferWatchtimeSetting } from "./InferWatchtimeSetting";

export default function UserSettingsPage() {
  const params = useParams();
  const serverId = Number(params.id);

  return (
    <Container className="max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">User Settings</h1>
          <p className="text-muted-foreground">
            Manage your personal preferences for this server.
          </p>
        </div>

        <div className="space-y-4">
          <InferWatchtimeSetting serverId={serverId} />
        </div>
      </div>
    </Container>
  );
}
