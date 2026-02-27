import "server-only";

import { db } from "@streamystats/database";
import { activities } from "@streamystats/database/schema";
import {
  type AnyColumn,
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";

interface PaginationOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
  type?: string;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
}

interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export const getActivities = async (
  serverId: number | string,
  options: PaginationOptions = {},
): Promise<PaginatedResult<typeof activities.$inferSelect>> => {
  const {
    page = 1,
    pageSize = 10,
    sortBy,
    sortOrder = "desc",
    search,
    type,
    dateFrom,
    dateTo,
    userId,
  } = options;
  const offset = (page - 1) * pageSize;

  // Build where condition
  const conditions: SQL[] = [eq(activities.serverId, Number(serverId))];

  if (search) {
    conditions.push(
      or(
        ilike(activities.name, `%${search}%`),
        ilike(activities.type, `%${search}%`),
      )!,
    );
  }

  if (type && type !== "all") {
    conditions.push(eq(activities.type, type));
  }

  if (userId && userId !== "all") {
    conditions.push(eq(activities.userId, userId));
  }

  if (dateFrom) {
    conditions.push(gte(activities.date, dateFrom));
  }

  if (dateTo) {
    conditions.push(lte(activities.date, dateTo));
  }

  const whereCondition = and(...conditions);

  // Get the total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(activities)
    .where(whereCondition);

  const total = totalResult?.count || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Determine sort order
  let orderByClause: SQL | undefined;
  if (sortBy) {
    // Map sortBy to actual column names
    let sortColumn: AnyColumn | undefined;
    switch (sortBy) {
      case "name":
        sortColumn = activities.name;
        break;
      case "type":
        sortColumn = activities.type;
        break;
      case "date":
        sortColumn = activities.date;
        break;
      case "severity":
        sortColumn = activities.severity;
        break;
      default:
        sortColumn = activities.date; // fallback
    }
    orderByClause = sortOrder === "asc" ? asc(sortColumn) : desc(sortColumn);
  } else {
    // Default sort by date descending
    orderByClause = desc(activities.date);
  }

  // Get the paginated data with sorting
  const data = await db
    .select()
    .from(activities)
    .where(whereCondition)
    .orderBy(orderByClause!)
    .limit(pageSize)
    .offset(offset);

  return {
    data,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
};

export const getUniqueActivityTypes = async (
  serverId: number | string,
): Promise<string[]> => {
  const result = await db
    .selectDistinct({ type: activities.type })
    .from(activities)
    .where(eq(activities.serverId, Number(serverId)))
    .orderBy(activities.type);

  return result.map((r) => r.type).filter(Boolean);
};
