import { Server } from "@/lib/db";

export function getExternalUrl(server: Server): string {
  return server.external_url || server.url;
}

export function getInternalUrl(server: Server): string {
  return server.internal_url || server.url;
}
