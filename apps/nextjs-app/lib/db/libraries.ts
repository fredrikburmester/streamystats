import "server-only";

import { db, libraries } from "@streamystats/database";
import { and, eq } from "drizzle-orm";

export const getLibraries = async ({ serverId }: { serverId: number }) => {
  return await db.query.libraries.findMany({
    where: eq(libraries.serverId, serverId),
  });
};

export const getLibrary = async ({
  serverId,
  libraryId,
}: {
  serverId: number;
  libraryId: number;
}) => {
  return await db.query.libraries.findFirst({
    where: and(
      eq(libraries.serverId, serverId),
      eq(libraries.id, String(libraryId)),
    ),
  });
};
