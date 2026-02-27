import "server-only";

import {
  db,
  type Item,
  items,
  type Session,
  sessions,
  type User,
  users,
} from "@streamystats/database";
import {
  type AnyColumn,
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  isNotNull,
  lte,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { getStatisticsExclusions } from "./exclusions";

export interface HistoryItem {
  session: Session;
  item: Item | null;
  user: User | null;
}

export interface HistoryResponse {
  data: HistoryItem[];
  totalCount: number;
  page: number;
  perPage: number;
  totalPages: number;
}

interface UserHistoryOptions {
  page?: number;
  perPage?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  startDate?: string;
  endDate?: string;
  itemType?: string;
  deviceName?: string;
  clientName?: string;
  playMethod?: string;
}

/**
 * Get playback history for a server with pagination and filtering
 */
export const getHistory = async (
  serverId: number,
  page = 1,
  perPage = 50,
  search?: string,
  sortBy?: string,
  sortOrder?: string,
  filters?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    itemType?: string;
    deviceName?: string;
    clientName?: string;
    playMethod?: string;
  },
): Promise<HistoryResponse> => {
  // Get exclusion settings
  const { userExclusion, itemLibraryExclusion } =
    await getStatisticsExclusions(serverId);

  const offset = (page - 1) * perPage;

  // Build base query conditions
  const conditions: SQL[] = [
    eq(sessions.serverId, serverId),
    isNotNull(sessions.itemId),
    isNotNull(sessions.userId),
  ];

  // Add exclusion filters
  if (userExclusion) {
    conditions.push(userExclusion);
  }
  if (itemLibraryExclusion) {
    conditions.push(itemLibraryExclusion);
  }

  // Add date range filters
  if (filters?.startDate) {
    const start = new Date(filters.startDate);
    start.setHours(0, 0, 0, 0);
    conditions.push(gte(sessions.createdAt, start));
  }

  if (filters?.endDate) {
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(sessions.createdAt, end));
  }

  // Add user filter
  if (filters?.userId) {
    conditions.push(eq(sessions.userId, filters.userId));
  }

  // Add device name filter
  if (filters?.deviceName) {
    conditions.push(eq(sessions.deviceName, filters.deviceName));
  }

  // Add client name filter
  if (filters?.clientName) {
    conditions.push(eq(sessions.clientName, filters.clientName));
  }

  // Add play method filter
  if (filters?.playMethod) {
    conditions.push(eq(sessions.playMethod, filters.playMethod));
  }

  // Add search filter if provided
  if (search?.trim()) {
    const searchTerm = `%${search.trim()}%`;
    conditions.push(
      or(
        ilike(sessions.itemName, searchTerm),
        ilike(sessions.userName, searchTerm),
        ilike(items.name, searchTerm),
        ilike(items.seriesName, searchTerm),
      )!,
    );
  }

  // Add item type filter if provided (requires items join)
  if (filters?.itemType && filters.itemType !== "all") {
    if (filters.itemType === "Series") {
      conditions.push(eq(items.type, "Episode"));
    } else {
      conditions.push(eq(items.type, filters.itemType));
    }
  }

  // Build the query to get session data with joined item and user information
  const baseQuery = db
    .select()
    .from(sessions)
    .leftJoin(items, eq(sessions.itemId, items.id))
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(and(...conditions));

  // Apply sorting
  let orderClause: SQL | undefined;
  const order = sortOrder === "asc" ? asc : desc;

  switch (sortBy) {
    case "item_name":
      orderClause = order(sessions.itemName);
      break;
    case "user_name":
      orderClause = order(sessions.userName);
      break;
    case "play_method":
      orderClause = order(sessions.playMethod);
      break;
    case "remote_end_point":
      orderClause = order(sessions.remoteEndPoint);
      break;
    case "client_name":
      orderClause = order(sessions.clientName);
      break;
    case "device_name":
      orderClause = order(sessions.deviceName);
      break;
    case "start_time":
      orderClause = order(sessions.startTime);
      break;
    case "date_created":
      orderClause = order(sessions.createdAt);
      break;
    default:
      orderClause = desc(sessions.startTime);
  }

  // Get paginated results
  const data = await baseQuery
    .orderBy(orderClause)
    .limit(perPage)
    .offset(offset);

  // Get total count for pagination
  const totalCountQuery = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(sessions)
    .leftJoin(items, eq(sessions.itemId, items.id))
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(and(...conditions));

  const totalCount = await totalCountQuery.then(
    (result) => result[0]?.count || 0,
  );

  const totalPages = Math.ceil(totalCount / perPage);

  return {
    data: data.map((row) => ({
      session: row.sessions,
      item: row.items,
      user: row.users,
    })),
    totalCount,
    page,
    perPage,
    totalPages,
  };
};

/**
 * Get playback history for a specific user
 */
export const getUserHistory = async (
  serverId: number,
  userId: string,
  options: UserHistoryOptions = {},
): Promise<HistoryResponse> => {
  const {
    page = 1,
    perPage = 50,
    search,
    sortBy,
    sortOrder = "desc",
    startDate,
    endDate,
    itemType,
    deviceName,
    clientName,
    playMethod,
  } = options;
  const offset = (page - 1) * perPage;

  // Build query conditions for specific user
  const conditions: SQL[] = [
    eq(sessions.serverId, serverId),
    eq(sessions.userId, userId),
    isNotNull(sessions.itemId),
  ];

  // Add search condition if provided
  if (search) {
    conditions.push(
      or(
        ilike(items.name, `%${search}%`),
        ilike(sessions.clientName, `%${search}%`),
        ilike(sessions.deviceName, `%${search}%`),
      )!,
    );
  }

  // Add date range filters
  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    conditions.push(gte(sessions.startTime, start));
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(sessions.startTime, end));
  }

  // Add item type filter
  if (itemType) {
    conditions.push(eq(items.type, itemType));
  }

  // Add device name filter
  if (deviceName) {
    conditions.push(eq(sessions.deviceName, deviceName));
  }

  // Add client name filter
  if (clientName) {
    conditions.push(eq(sessions.clientName, clientName));
  }

  // Add play method filter
  if (playMethod) {
    conditions.push(eq(sessions.playMethod, playMethod));
  }

  // Build the query to get session data with joined item and user information
  const baseQuery = db
    .select()
    .from(sessions)
    .leftJoin(items, eq(sessions.itemId, items.id))
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(and(...conditions));

  // Determine sort order
  let orderByClause: SQL | undefined;
  if (sortBy) {
    let sortColumn: AnyColumn | undefined;
    switch (sortBy) {
      case "item_name":
        sortColumn = items.name;
        break;
      case "play_method":
        sortColumn = sessions.playMethod;
        break;
      case "remote_end_point":
        sortColumn = sessions.remoteEndPoint;
        break;
      case "client_name":
        sortColumn = sessions.clientName;
        break;
      case "device_name":
        sortColumn = sessions.deviceName;
        break;
      case "start_time":
        sortColumn = sessions.startTime;
        break;
      case "date_created":
        sortColumn = sessions.createdAt;
        break;
      default:
        sortColumn = sessions.startTime;
    }
    orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
  } else {
    orderByClause = desc(sessions.startTime);
  }

  // Get paginated results
  const data = await baseQuery
    .orderBy(orderByClause)
    .limit(perPage)
    .offset(offset);

  // Get total count for pagination
  const totalCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(sessions)
    .leftJoin(items, eq(sessions.itemId, items.id))
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(and(...conditions))
    .then((result) => result[0]?.count || 0);

  const totalPages = Math.ceil(totalCount / perPage);

  return {
    data: data.map((row) => ({
      session: row.sessions,
      item: row.items,
      user: row.users,
    })),
    totalCount,
    page,
    perPage,
    totalPages,
  };
};

/**
 * Get playback history for a specific item
 */
export const getItemHistory = async (
  serverId: number,
  itemId: string,
  page = 1,
  perPage = 50,
): Promise<HistoryResponse> => {
  // Get exclusion settings
  const { userExclusion } = await getStatisticsExclusions(serverId);

  const offset = (page - 1) * perPage;

  const conditions: SQL[] = [
    eq(sessions.serverId, serverId),
    eq(sessions.itemId, itemId),
    isNotNull(sessions.userId),
  ];

  // Add exclusion filters
  if (userExclusion) {
    conditions.push(userExclusion);
  }

  const data = await db
    .select()
    .from(sessions)
    .leftJoin(items, eq(sessions.itemId, items.id))
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(sessions.createdAt))
    .limit(perPage)
    .offset(offset);

  const totalCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(sessions)
    .where(and(...conditions))
    .then((result) => result[0]?.count || 0);

  const totalPages = Math.ceil(totalCount / perPage);

  return {
    data: data.map((row) => ({
      session: row.sessions,
      item: row.items,
      user: row.users,
    })),
    totalCount,
    page,
    perPage,
    totalPages,
  };
};

/**
 * Get playback history with filters for user, item type, and time interval
 */
export const getHistoryByFilters = async ({
  serverId,
  userId,
  itemType,
  startDate,
  endDate,
  limit = 50,
}: {
  serverId: number;
  userId?: string;
  itemType?: "Movie" | "Series" | "Episode" | "all";
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<HistoryItem[]> => {
  // Get exclusion settings
  const { userExclusion, itemLibraryExclusion } =
    await getStatisticsExclusions(serverId);

  const conditions: SQL[] = [
    eq(sessions.serverId, serverId),
    isNotNull(sessions.itemId),
    isNotNull(sessions.userId),
    isNotNull(sessions.startTime),
  ];

  // Add exclusion filters
  if (userExclusion) {
    conditions.push(userExclusion);
  }
  if (itemLibraryExclusion) {
    conditions.push(itemLibraryExclusion);
  }

  if (userId) {
    conditions.push(eq(sessions.userId, userId));
  }

  if (startDate) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    conditions.push(gte(sessions.startTime, start));
  }

  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(sessions.startTime, end));
  }

  const needsItemJoin =
    itemType && itemType !== "all" && itemType !== undefined;

  const query = db
    .select()
    .from(sessions)
    .leftJoin(items, eq(sessions.itemId, items.id))
    .leftJoin(users, eq(sessions.userId, users.id));

  if (needsItemJoin) {
    if (itemType === "Series") {
      conditions.push(eq(items.type, "Episode"));
    } else {
      conditions.push(eq(items.type, itemType));
    }
  }

  const data = await query
    .where(and(...conditions))
    .orderBy(desc(sessions.startTime))
    .limit(limit);

  return data.map((row) => ({
    session: row.sessions,
    item: row.items,
    user: row.users,
  }));
};

/**
 * Get unique device names for a server
 */
export const getUniqueDeviceNames = async (
  serverId: number,
): Promise<string[]> => {
  const result = await db
    .selectDistinct({ deviceName: sessions.deviceName })
    .from(sessions)
    .where(
      and(
        eq(sessions.serverId, serverId),
        isNotNull(sessions.deviceName),
        isNotNull(sessions.itemId),
      ),
    )
    .orderBy(sessions.deviceName);

  return result
    .map((r) => r.deviceName)
    .filter((name): name is string => name !== null);
};

/**
 * Get unique client names for a server
 */
export const getUniqueClientNames = async (
  serverId: number,
): Promise<string[]> => {
  const result = await db
    .selectDistinct({ clientName: sessions.clientName })
    .from(sessions)
    .where(
      and(
        eq(sessions.serverId, serverId),
        isNotNull(sessions.clientName),
        isNotNull(sessions.itemId),
      ),
    )
    .orderBy(sessions.clientName);

  return result
    .map((r) => r.clientName)
    .filter((name): name is string => name !== null);
};

/**
 * Get unique play methods for a server
 */
export const getUniquePlayMethods = async (
  serverId: number,
): Promise<string[]> => {
  const result = await db
    .selectDistinct({ playMethod: sessions.playMethod })
    .from(sessions)
    .where(
      and(
        eq(sessions.serverId, serverId),
        isNotNull(sessions.playMethod),
        isNotNull(sessions.itemId),
      ),
    )
    .orderBy(sessions.playMethod);

  return result
    .map((r) => r.playMethod)
    .filter((method): method is string => method !== null);
};
