import "server-only";

import { db, libraries } from "@streamystats/database";
import { and, eq } from "drizzle-orm";
import { getStatisticsExclusions } from "./exclusions";

export const getLibraries = async ({
  serverId,
  userId,
  includeExcluded = false,
}: {
  serverId: number;
  userId?: string;
  /** When true, skip statistics exclusion filters (needed for the exclusions manager UI). */
  includeExcluded?: boolean;
}) => {
  if (includeExcluded) {
    return await db.query.libraries.findMany({
      where: eq(libraries.serverId, serverId),
    });
  }

  const { librariesTableExclusion } = await getStatisticsExclusions(
    serverId,
    userId,
  );

  return await db.query.libraries.findMany({
    where: and(eq(libraries.serverId, serverId), librariesTableExclusion),
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
