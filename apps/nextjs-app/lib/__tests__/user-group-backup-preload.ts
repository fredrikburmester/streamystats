import { mock } from "bun:test";
import "./user-group-preload";

mock.module("@/lib/api-auth", () => ({
  requireAdmin: async (serverId: number) => ({
    error: null,
    session: { serverId, id: "fixture-admin", name: "Fixture admin" },
  }),
}));
globalThis.fetch = async () => Response.json({ Id: "same-jellyfin-system" });
