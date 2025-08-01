import {
  db,
  sessions,
  items,
  users,
  Session,
  Item,
  User,
} from "@streamystats/database";
import { and, eq, desc, sql, isNotNull, ilike, asc, or } from "drizzle-orm";

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
}

/**
 * Get playback history for a server with pagination and filtering
 */
export const getHistory = async (
  serverId: number,
  page: number = 1,
  perPage: number = 50,
  search?: string,
  sortBy?: string,
  sortOrder?: string
): Promise<HistoryResponse> => {
  const offset = (page - 1) * perPage;

  // Build base query conditions
  const conditions = [
    eq(sessions.serverId, serverId),
    isNotNull(sessions.itemId),
    isNotNull(sessions.userId),
  ];

  // Add search filter if provided
  if (search && search.trim()) {
    conditions.push(
      sql`(${sessions.itemName} ILIKE ${`%${search.trim()}%`} OR ${
        sessions.userName
      } ILIKE ${`%${search.trim()}%`})`
    );
  }

  // Build the query to get session data with joined item and user information
  const baseQuery = db
    .select()
    .from(sessions)
    .leftJoin(items, eq(sessions.itemId, items.id))
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(and(...conditions));

  // Apply sorting
  let orderClause;
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
    case "date_created":
      orderClause = order(sessions.createdAt);
      break;
    default:
      orderClause = desc(sessions.createdAt);
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
    (result) => result[0]?.count || 0
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
  options: UserHistoryOptions = {}
): Promise<HistoryResponse> => {
  const { page = 1, perPage = 50, search, sortBy, sortOrder = "desc" } = options;
  const offset = (page - 1) * perPage;

  // Build query conditions for specific user
  const conditions = [
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
        ilike(sessions.deviceName, `%${search}%`)
      )!
    );
  }

  // Build the query to get session data with joined item and user information
  const baseQuery = db
    .select()
    .from(sessions)
    .leftJoin(items, eq(sessions.itemId, items.id))
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(and(...conditions));

  // Determine sort order
  let orderByClause;
  if (sortBy) {
    let sortColumn;
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
      case "date_created":
        sortColumn = sessions.createdAt;
        break;
      default:
        sortColumn = sessions.createdAt;
    }
    orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
  } else {
    orderByClause = desc(sessions.createdAt);
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
  page: number = 1,
  perPage: number = 50
): Promise<HistoryResponse> => {
  const offset = (page - 1) * perPage;

  const data = await db
    .select()
    .from(sessions)
    .leftJoin(items, eq(sessions.itemId, items.id))
    .leftJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.itemId, itemId),
        isNotNull(sessions.userId)
      )
    )
    .orderBy(desc(sessions.createdAt))
    .limit(perPage)
    .offset(offset);

  const totalCount = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(sessions)
    .where(
      and(
        eq(sessions.serverId, serverId),
        eq(sessions.itemId, itemId),
        isNotNull(sessions.userId)
      )
    )
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
