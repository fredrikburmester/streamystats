import { db } from "@streamystats/database";
import { activities } from "@streamystats/database/schema";
import { eq, count, asc, desc, ilike, and, or } from "drizzle-orm";

interface PaginationOptions {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  search?: string;
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
  options: PaginationOptions = {}
): Promise<PaginatedResult<typeof activities.$inferSelect>> => {
  const { page = 1, pageSize = 10, sortBy, sortOrder = "desc", search } = options;
  const offset = (page - 1) * pageSize;

  // Build where condition
  const baseWhere = eq(activities.serverId, Number(serverId));
  const whereCondition = search
    ? and(
        baseWhere,
        or(
          ilike(activities.name, `%${search}%`),
          ilike(activities.type, `%${search}%`)
        )
      )
    : baseWhere;

  // Get the total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(activities)
    .where(whereCondition);

  const total = totalResult.count;
  const totalPages = Math.ceil(total / pageSize);

  // Determine sort order
  let orderByClause;
  if (sortBy) {
    // Map sortBy to actual column names
    let sortColumn;
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
    .orderBy(orderByClause)
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
