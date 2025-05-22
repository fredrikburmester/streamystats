"use client";

import { getServers } from "@/lib/db";
import { preferredServerIdAtom, serverOrderAtom } from "@/lib/atoms/serverAtom";
import { useAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const [servers, setServers] = useState<
    Awaited<ReturnType<typeof getServers>>
  >([]);
  const [preferredServerId] = useAtom(preferredServerIdAtom);
  const [serverOrder] = useAtom(serverOrderAtom);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadServers = async () => {
      const serverList = await getServers();
      setServers(serverList);
      setLoading(false);
    };

    loadServers();
  }, []);

  useEffect(() => {
    if (loading || servers.length === 0) return;

    // If no servers exist, redirect to setup
    if (servers.length === 0) {
      router.push("/setup");
      return;
    }

    // Try to use preferred server first
    if (preferredServerId) {
      const preferredServer = servers.find((s) => s.id === preferredServerId);
      if (preferredServer) {
        router.push(`/servers/${preferredServer.id}/dashboard`);
        return;
      }
    }

    // Apply custom server order if it exists
    let orderedServers = [...servers];
    if (serverOrder.length > 0) {
      // Sort servers according to custom order, with unordered servers at the end
      orderedServers = serverOrder
        .map((id) => servers.find((s) => s.id === id))
        .filter((server): server is NonNullable<typeof server> =>
          Boolean(server)
        )
        .concat(servers.filter((s) => !serverOrder.includes(s.id)));
    }

    // Fallback to first server (either custom ordered or original order)
    if (orderedServers[0]?.id) {
      router.push(`/servers/${orderedServers[0].id}/dashboard`);
    } else {
      router.push("/setup");
    }
  }, [loading, servers, preferredServerId, serverOrder, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return null; // Component will redirect, so no need to render anything
}
