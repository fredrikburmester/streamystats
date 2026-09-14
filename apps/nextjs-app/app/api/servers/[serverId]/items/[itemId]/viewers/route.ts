import { db, items, sessions, users } from "@streamystats/database";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  like,
  type SQL,
  sql,
  sum,
} from "drizzle-orm";
import type { NextRequest } from "next/server";
import type { ItemUserStats } from "@/lib/db/items";
import { getServer } from "@/lib/db/server";
import { isUserAdmin } from "@/lib/db/users";

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ serverId: string; itemId: string }>;
  },
) {
  const { serverId, itemId } = await params;

  const isAdmin = await isUserAdmin();
  if (!isAdmin) {
    return new Response(
      JSON.stringify({
        error: "Unauthorized - admin access required",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  const server = await getServer({ serverId });
  if (!server) {
    return new Response(
      JSON.stringify({
        error: "Server not found",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") || "1", 10),
  );
  const pageSize = Math.max(
    1,
    Math.min(100, Number.parseInt(searchParams.get("pageSize") || "5", 10)),
  );
  const search = searchParams.get("search")?.trim() || "";
  const completion = searchParams.get("completion") || "all";
  const sortBy = searchParams.get("sortBy") || "lastWatched";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });

  if (!item) {
    return new Response(
      JSON.stringify({
        error: "Item not found",
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  if (item.serverId !== Number.parseInt(serverId, 10)) {
    return new Response(
      JSON.stringify({
        error: "Item does not belong to the specified server",
      }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }

  let itemIdsToQuery: string[] = [itemId];

  // If it's a series, get all episode IDs
  if (item.type === "Series") {
    const episodes = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.type, "Episode"), eq(items.seriesId, itemId)));

    itemIdsToQuery = episodes.map((ep) => ep.id);

    if (itemIdsToQuery.length === 0) {
      return new Response(
        JSON.stringify({
          data: [],
          pagination: { page, pageSize, total: 0, totalPages: 0 },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "private, max-age=60",
          },
        },
      );
    }
  }

  // Build WHERE conditions
  const whereConditions = [inArray(sessions.itemId, itemIdsToQuery)];

  if (search) {
    whereConditions.push(like(users.name, `%${search.trim()}%`));
  }

  // Build HAVING conditions for completion filter
  let havingCondition: SQL | undefined;
  if (completion === "completed") {
    havingCondition = sql`AVG(${sessions.percentComplete}) >= 90`;
  } else if (completion === "partial") {
    havingCondition = sql`AVG(${sessions.percentComplete}) >= 50 AND AVG(${sessions.percentComplete}) < 90`;
  } else if (completion === "minimal") {
    havingCondition = sql`AVG(${sessions.percentComplete}) < 50`;
  }

  // Build ORDER BY clause
  const orderDirection = sortOrder === "asc" ? asc : desc;
  let orderByClause: SQL | undefined;

  switch (sortBy) {
    case "userName":
      orderByClause = orderDirection(users.name);
      break;
    case "watchCount":
      orderByClause = orderDirection(sql`COUNT(${sessions.id})`);
      break;
    case "totalWatchTime":
      orderByClause = orderDirection(sql`SUM(${sessions.playDuration})`);
      break;
    case "completionRate":
      orderByClause = orderDirection(sql`AVG(${sessions.percentComplete})`);
      break;
    default:
      orderByClause = orderDirection(sql`MAX(${sessions.startTime})`);
  }

  const offset = (page - 1) * pageSize;

  const countQueryBase = db
    .select({ count: count() })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(...whereConditions))
    .groupBy(sessions.userId);

  const dataQueryBase = db
    .select({
      userId: sessions.userId,
      userName: users.name,
      watchCount: count(sessions.id),
      totalWatchTime: sum(sessions.playDuration),
      completionRate: sql<number>`AVG(${sessions.percentComplete})`,
      firstWatched: sql<Date>`MIN(${sessions.startTime})`,
      lastWatched: sql<Date>`MAX(${sessions.startTime})`,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(...whereConditions))
    .groupBy(sessions.userId, users.name);

  const countQuery = havingCondition
    ? countQueryBase.having(havingCondition)
    : countQueryBase;

  const dataQuery = havingCondition
    ? dataQueryBase.having(havingCondition)
    : dataQueryBase;

  const [countResult, viewersRaw] = await Promise.all([
    countQuery,
    dataQuery.orderBy(orderByClause).limit(pageSize).offset(offset),
  ]);

  const total = countResult.length;
  const totalPages = Math.ceil(total / pageSize);

  const data: ItemUserStats[] = viewersRaw.flatMap((r) => {
    if (!r.userId) return [];

    const user: ItemUserStats["user"] = {
      id: r.userId,
      name: r.userName || "Unknown User",
    } as ItemUserStats["user"];

    return [
      {
        user,
        watchCount: Number(r.watchCount) || 0,
        totalWatchTime: Number(r.totalWatchTime || 0),
        completionRate: Math.round((Number(r.completionRate) || 0) * 10) / 10,
        firstWatched: r.firstWatched
          ? new Date(r.firstWatched).toISOString()
          : null,
        lastWatched: r.lastWatched
          ? new Date(r.lastWatched).toISOString()
          : null,
      },
    ];
  });

  return new Response(
    JSON.stringify({
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60",
      },
    },
  );
}
