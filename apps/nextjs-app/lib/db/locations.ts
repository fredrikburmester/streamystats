"use server";

import "server-only";

import {
  activities,
  activityLocations,
  anomalyEvents,
  db,
  userFingerprints,
  users,
} from "@streamystats/database";
import { and, count, desc, eq, gte, lte, sql } from "drizzle-orm";

export interface LocationPoint {
  latitude: number;
  longitude: number;
  countryCode: string | null;
  country: string | null;
  city: string | null;
  activityCount: number;
  lastSeen: string;
  userId?: string | null;
  userName?: string | null;
}

export interface LocationEntry {
  id: number;
  activityId: string;
  ipAddress: string;
  countryCode: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  isPrivateIp: boolean;
  createdAt: string;
  activityType: string | null;
  activityName: string | null;
  activityDate: string | null;
}

export interface AnomalyDetails {
  description: string;
  previousLocation?: {
    country: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    activityId?: string;
    activityTime?: string;
  };
  currentLocation?: {
    country: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    activityId?: string;
    activityTime?: string;
  };
  distanceKm?: number;
  timeDiffMinutes?: number;
  speedKmh?: number;
  deviceId?: string;
  deviceName?: string;
  clientName?: string;
  previousactivityId?: string;
}

export interface Anomaly {
  id: number;
  userId: string | null;
  userName?: string | null;
  activityId: string | null;
  anomalyType: string;
  severity: "low" | "medium" | "high" | "critical";
  details: AnomalyDetails;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNote: string | null;
  createdAt: string;
}

export interface UserFingerprint {
  id: number;
  userId: string;
  serverId: number;
  knownCountries: string[];
  knownCities: string[];
  knownDeviceIds: string[];
  knownClients: string[];
  locationPatterns: Array<{
    country: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    sessionCount: number;
    lastSeenAt: string;
  }>;
  devicePatterns: Array<{
    deviceId: string;
    deviceName: string | null;
    clientName: string | null;
    sessionCount: number;
    lastSeenAt: string;
  }>;
  hourHistogram: Record<number, number>;
  avgSessionsPerDay: number | null;
  totalSessions: number | null;
  lastCalculatedAt: string | null;
}

/**
 * Get unique locations for a user (aggregated by country/city)
 */
export async function getUserUniqueLocations(
  serverId: number,
  userId: string,
): Promise<LocationPoint[]> {
  const result = await db
    .select({
      countryCode: activityLocations.countryCode,
      country: activityLocations.country,
      city: activityLocations.city,
      latitude: activityLocations.latitude,
      longitude: activityLocations.longitude,
      activityCount: count(),
      lastSeen: sql<string>`MAX(${activities.date})`,
    })
    .from(activityLocations)
    .innerJoin(activities, eq(activityLocations.activityId, activities.id))
    .where(
      and(
        eq(activities.userId, userId),
        eq(activities.serverId, serverId),
        eq(activityLocations.isPrivateIp, false),
      ),
    )
    .groupBy(
      activityLocations.countryCode,
      activityLocations.country,
      activityLocations.city,
      activityLocations.latitude,
      activityLocations.longitude,
    )
    .orderBy(desc(sql`MAX(${activities.date})`));

  return result.map((r) => ({
    countryCode: r.countryCode,
    country: r.country,
    city: r.city,
    latitude: r.latitude ?? 0,
    longitude: r.longitude ?? 0,
    activityCount: Number(r.activityCount),
    lastSeen: r.lastSeen,
  }));
}

/**
 * Get location history for a user
 */
export async function getUserLocationHistory(
  serverId: number,
  userId: string,
  limit = 50,
): Promise<LocationEntry[]> {
  const result = await db
    .select({
      id: activityLocations.id,
      activityId: activityLocations.activityId,
      ipAddress: activityLocations.ipAddress,
      countryCode: activityLocations.countryCode,
      country: activityLocations.country,
      region: activityLocations.region,
      city: activityLocations.city,
      latitude: activityLocations.latitude,
      longitude: activityLocations.longitude,
      timezone: activityLocations.timezone,
      isPrivateIp: activityLocations.isPrivateIp,
      createdAt: activityLocations.createdAt,
      activityType: activities.type,
      activityName: activities.name,
      activityDate: activities.date,
    })
    .from(activityLocations)
    .innerJoin(activities, eq(activityLocations.activityId, activities.id))
    .where(
      and(eq(activities.userId, userId), eq(activities.serverId, serverId)),
    )
    .orderBy(desc(activities.date))
    .limit(limit);

  return result.map((r) => ({
    id: r.id,
    activityId: r.activityId,
    ipAddress: r.ipAddress,
    countryCode: r.countryCode,
    country: r.country,
    region: r.region,
    city: r.city,
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
    isPrivateIp: r.isPrivateIp,
    createdAt: r.createdAt.toISOString(),
    activityType: r.activityType,
    activityName: r.activityName,
    activityDate: r.activityDate?.toISOString() ?? null,
  }));
}

/**
 * Get user fingerprint
 */
export async function getUserFingerprint(
  serverId: number,
  userId: string,
): Promise<UserFingerprint | null> {
  const result = await db.query.userFingerprints.findFirst({
    where: and(
      eq(userFingerprints.userId, userId),
      eq(userFingerprints.serverId, serverId),
    ),
  });

  if (!result) return null;

  return {
    id: result.id,
    userId: result.userId,
    serverId: result.serverId,
    knownCountries: (result.knownCountries as string[]) || [],
    knownCities: (result.knownCities as string[]) || [],
    knownDeviceIds: (result.knownDeviceIds as string[]) || [],
    knownClients: (result.knownClients as string[]) || [],
    locationPatterns:
      (result.locationPatterns as UserFingerprint["locationPatterns"]) || [],
    devicePatterns:
      (result.devicePatterns as UserFingerprint["devicePatterns"]) || [],
    hourHistogram: (result.hourHistogram as Record<number, number>) || {},
    avgSessionsPerDay: result.avgSessionsPerDay,
    totalSessions: result.totalSessions,
    lastCalculatedAt: result.lastCalculatedAt?.toISOString() ?? null,
  };
}

/**
 * Get hourly activity histogram for a user within a date range
 */
export async function getUserHourHistogram(
  serverId: number,
  userId: string,
  startDate?: Date,
  endDate?: Date,
): Promise<Record<number, number>> {
  const conditions = [
    eq(activities.userId, userId),
    eq(activities.serverId, serverId),
  ];

  if (startDate) {
    conditions.push(gte(activities.date, startDate));
  }
  if (endDate) {
    conditions.push(lte(activities.date, endDate));
  }

  const result = await db
    .select({
      hour: sql<number>`EXTRACT(HOUR FROM ${activities.date})`.as("hour"),
      count: count(),
    })
    .from(activities)
    .where(and(...conditions))
    .groupBy(sql`EXTRACT(HOUR FROM ${activities.date})`);

  const histogram: Record<number, number> = {};
  for (const row of result) {
    histogram[row.hour] = row.count;
  }
  return histogram;
}

/**
 * Get anomalies for a user
 */
export async function getUserAnomalies(
  serverId: number,
  userId: string,
  options: { resolved?: boolean; limit?: number } = {},
): Promise<{ anomalies: Anomaly[]; unresolvedCount: number }> {
  const { resolved, limit = 50 } = options;

  let whereClause = and(
    eq(anomalyEvents.userId, userId),
    eq(anomalyEvents.serverId, serverId),
  );

  if (resolved !== undefined) {
    whereClause = and(whereClause, eq(anomalyEvents.resolved, resolved));
  }

  const anomalies = await db
    .select()
    .from(anomalyEvents)
    .where(whereClause)
    .orderBy(desc(anomalyEvents.createdAt))
    .limit(limit);

  const unresolvedResult = await db
    .select({ count: count() })
    .from(anomalyEvents)
    .where(
      and(
        eq(anomalyEvents.userId, userId),
        eq(anomalyEvents.serverId, serverId),
        eq(anomalyEvents.resolved, false),
      ),
    );

  const unresolvedCount = Number(unresolvedResult[0]?.count || 0);

  return {
    anomalies: anomalies.map((a) => ({
      id: a.id,
      userId: a.userId,
      activityId: a.activityId,
      anomalyType: a.anomalyType,
      severity: a.severity as Anomaly["severity"],
      details: a.details as AnomalyDetails,
      resolved: a.resolved,
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
      resolvedBy: a.resolvedBy,
      resolutionNote: a.resolutionNote,
      createdAt: a.createdAt.toISOString(),
    })),
    unresolvedCount,
  };
}

/**
 * Get all anomalies for a server (admin view)
 */
export async function getServerAnomalies(
  serverId: number,
  options: {
    resolved?: boolean;
    severity?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<{
  anomalies: Anomaly[];
  severityBreakdown: Record<string, number>;
  total: number;
}> {
  const {
    resolved,
    severity,
    userId,
    dateFrom,
    dateTo,
    limit = 50,
    offset = 0,
  } = options;

  const conditions = [eq(anomalyEvents.serverId, serverId)];

  if (resolved !== undefined) {
    conditions.push(eq(anomalyEvents.resolved, resolved));
  }

  if (severity) {
    conditions.push(eq(anomalyEvents.severity, severity));
  }

  if (userId) {
    conditions.push(eq(anomalyEvents.userId, userId));
  }

  if (dateFrom) {
    conditions.push(gte(anomalyEvents.createdAt, new Date(dateFrom)));
  }

  if (dateTo) {
    conditions.push(lte(anomalyEvents.createdAt, new Date(dateTo)));
  }

  const whereClause = and(...conditions);

  const [anomalies, totalResult, severityBreakdown] = await Promise.all([
    db
      .select({
        id: anomalyEvents.id,
        userId: anomalyEvents.userId,
        activityId: anomalyEvents.activityId,
        anomalyType: anomalyEvents.anomalyType,
        severity: anomalyEvents.severity,
        details: anomalyEvents.details,
        resolved: anomalyEvents.resolved,
        resolvedAt: anomalyEvents.resolvedAt,
        resolvedBy: anomalyEvents.resolvedBy,
        resolutionNote: anomalyEvents.resolutionNote,
        createdAt: anomalyEvents.createdAt,
        userName: users.name,
      })
      .from(anomalyEvents)
      .leftJoin(users, eq(anomalyEvents.userId, users.id))
      .where(whereClause)
      .orderBy(desc(anomalyEvents.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: count() }).from(anomalyEvents).where(whereClause),
    db
      .select({
        severity: anomalyEvents.severity,
        count: count(),
      })
      .from(anomalyEvents)
      .where(
        and(
          eq(anomalyEvents.serverId, serverId),
          eq(anomalyEvents.resolved, false),
        ),
      )
      .groupBy(anomalyEvents.severity),
  ]);

  return {
    anomalies: anomalies.map((a) => ({
      id: a.id,
      userId: a.userId,
      userName: a.userName,
      activityId: a.activityId,
      anomalyType: a.anomalyType,
      severity: a.severity as Anomaly["severity"],
      details: a.details as AnomalyDetails,
      resolved: a.resolved,
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
      resolvedBy: a.resolvedBy,
      resolutionNote: a.resolutionNote,
      createdAt: a.createdAt.toISOString(),
    })),
    severityBreakdown: Object.fromEntries(
      severityBreakdown.map((s) => [s.severity, Number(s.count)]),
    ),
    total: Number(totalResult[0]?.count || 0),
  };
}

/**
 * Resolve specific anomalies by IDs
 */
export async function resolveAnomaliesByIds(
  serverId: number,
  anomalyIds: number[],
  options: { resolvedBy?: string; resolutionNote?: string } = {},
): Promise<number> {
  if (anomalyIds.length === 0) return 0;

  const result = await db
    .update(anomalyEvents)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: options.resolvedBy ?? null,
      resolutionNote: options.resolutionNote ?? "Bulk resolved",
    })
    .where(
      and(
        eq(anomalyEvents.serverId, serverId),
        sql`${anomalyEvents.id} = ANY(${anomalyIds})`,
      ),
    )
    .returning({ id: anomalyEvents.id });

  return result.length;
}

/**
 * Resolve an anomaly
 */
export async function resolveAnomaly(
  serverId: number,
  anomalyId: number,
  options: { resolvedBy?: string; resolutionNote?: string } = {},
): Promise<boolean> {
  const result = await db
    .update(anomalyEvents)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: options.resolvedBy ?? null,
      resolutionNote: options.resolutionNote ?? null,
    })
    .where(
      and(
        eq(anomalyEvents.id, anomalyId),
        eq(anomalyEvents.serverId, serverId),
      ),
    )
    .returning({ id: anomalyEvents.id });

  return result.length > 0;
}

/**
 * Resolve all unresolved anomalies for a server
 */
export async function resolveAllAnomalies(
  serverId: number,
  options: { resolvedBy?: string; resolutionNote?: string } = {},
): Promise<number> {
  const result = await db
    .update(anomalyEvents)
    .set({
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: options.resolvedBy ?? null,
      resolutionNote: options.resolutionNote ?? "Bulk resolved",
    })
    .where(
      and(
        eq(anomalyEvents.serverId, serverId),
        eq(anomalyEvents.resolved, false),
      ),
    )
    .returning({ id: anomalyEvents.id });

  return result.length;
}

/**
 * Unresolve an anomaly
 */
export async function unresolveAnomaly(
  serverId: number,
  anomalyId: number,
): Promise<boolean> {
  const result = await db
    .update(anomalyEvents)
    .set({
      resolved: false,
      resolvedAt: null,
      resolvedBy: null,
      resolutionNote: null,
    })
    .where(
      and(
        eq(anomalyEvents.id, anomalyId),
        eq(anomalyEvents.serverId, serverId),
      ),
    )
    .returning({ id: anomalyEvents.id });

  return result.length > 0;
}

export interface LocationFilters {
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Get all unique locations for a server (for map visualization)
 * Aggregates users per location for the popup display
 */
export async function getServerLocations(
  serverId: number,
  filters: LocationFilters = {},
): Promise<LocationPoint[]> {
  const conditions = [
    eq(activities.serverId, serverId),
    eq(activityLocations.isPrivateIp, false),
  ];

  if (filters.userId) {
    conditions.push(eq(activities.userId, filters.userId));
  }

  if (filters.dateFrom) {
    conditions.push(gte(activities.date, new Date(filters.dateFrom)));
  }

  if (filters.dateTo) {
    conditions.push(lte(activities.date, new Date(filters.dateTo)));
  }

  // Get per-user location data
  const result = await db
    .select({
      userId: activities.userId,
      userName: users.name,
      countryCode: activityLocations.countryCode,
      country: activityLocations.country,
      city: activityLocations.city,
      latitude: activityLocations.latitude,
      longitude: activityLocations.longitude,
      activityCount: count(),
      lastSeen: sql<string>`MAX(${activities.date})`,
    })
    .from(activityLocations)
    .innerJoin(activities, eq(activityLocations.activityId, activities.id))
    .leftJoin(users, eq(activities.userId, users.id))
    .where(and(...conditions))
    .groupBy(
      activities.userId,
      users.name,
      activityLocations.countryCode,
      activityLocations.country,
      activityLocations.city,
      activityLocations.latitude,
      activityLocations.longitude,
    )
    .orderBy(desc(sql`MAX(${activities.date})`));

  // Aggregate by location (lat/lng + city)
  const locationMap = new Map<
    string,
    {
      latitude: number;
      longitude: number;
      countryCode: string | null;
      country: string | null;
      city: string | null;
      activityCount: number;
      lastSeen: string;
      users: {
        userId: string;
        userName: string | null;
        activityCount: number;
        lastSeen: string;
      }[];
    }
  >();

  for (const r of result) {
    const key = `${r.latitude}-${r.longitude}-${r.city || "unknown"}`;
    const existing = locationMap.get(key);

    const userEntry = {
      userId: r.userId || "unknown",
      userName: r.userName,
      activityCount: Number(r.activityCount),
      lastSeen: r.lastSeen,
    };

    if (existing) {
      existing.activityCount += Number(r.activityCount);
      if (r.lastSeen > existing.lastSeen) {
        existing.lastSeen = r.lastSeen;
      }
      existing.users.push(userEntry);
    } else {
      locationMap.set(key, {
        latitude: r.latitude ?? 0,
        longitude: r.longitude ?? 0,
        countryCode: r.countryCode,
        country: r.country,
        city: r.city,
        activityCount: Number(r.activityCount),
        lastSeen: r.lastSeen,
        users: [userEntry],
      });
    }
  }

  return Array.from(locationMap.values()).map((loc) => ({
    ...loc,
    users: loc.users.sort((a, b) => b.activityCount - a.activityCount),
  }));
}

/**
 * Check if a geolocation backfill job is currently running for a server
 */
export async function isBackfillJobRunning(serverId: number): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT 1
      FROM pgboss.job
      WHERE name = 'backfill-activity-locations'
        AND state IN ('created', 'active', 'retry')
        AND data->>'serverId' = ${serverId.toString()}
      LIMIT 1
    `);
    return result.length > 0;
  } catch {
    // pgboss schema might not be accessible, assume not running
    return false;
  }
}

/**
 * Trigger geolocation backfill job for a server
 */
export async function triggerGeolocationBackfill(serverId: number): Promise<{
  success: boolean;
  error?: string;
  alreadyRunning?: boolean;
}> {
  try {
    // Check if already running
    const running = await isBackfillJobRunning(serverId);
    if (running) {
      return {
        success: false,
        alreadyRunning: true,
        error: "Backfill job is already running",
      };
    }

    const jobServerUrl = process.env.JOB_SERVER_URL || "http://localhost:3001";
    const response = await fetch(
      `${jobServerUrl}/api/servers/${serverId}/locations/backfill`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      const data = await response.json();
      return {
        success: false,
        error: data.error || "Failed to start backfill",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error triggering backfill:", error);
    return { success: false, error: "Failed to connect to job server" };
  }
}

/**
 * Trigger fingerprint recalculation job for a server
 */
export async function triggerFingerprintRecalculation(
  serverId: number,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const jobServerUrl = process.env.JOB_SERVER_URL || "http://localhost:3001";
    const response = await fetch(
      `${jobServerUrl}/api/servers/${serverId}/fingerprints/recalculate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      const data = await response.json();
      return {
        success: false,
        error: data.error || "Failed to start recalculation",
      };
    }

    return { success: true };
  } catch (error) {
    console.error("Error triggering fingerprint recalculation:", error);
    return { success: false, error: "Failed to connect to job server" };
  }
}

/**
 * Get location statistics for a server
 */
export async function getServerLocationStats(serverId: number): Promise<{
  totalLocatedActivities: number;
  pendingActivities: number;
  uniqueCountries: number;
  uniqueCities: number;
  usersWithFingerprints: number;
  unresolvedAnomalies: Record<string, number>;
  isBackfillRunning: boolean;
}> {
  // Total activities with location
  const totalLocatedResult = await db
    .select({ count: count() })
    .from(activityLocations)
    .innerJoin(activities, eq(activityLocations.activityId, activities.id))
    .where(
      and(
        eq(activities.serverId, serverId),
        eq(activityLocations.isPrivateIp, false),
      ),
    );

  // Total activities without location (pending geolocation)
  // Only count activities that have IP in shortOverview since we can't geolocate without one
  const pendingResult = await db
    .select({ count: count() })
    .from(activities)
    .leftJoin(
      activityLocations,
      eq(activities.id, activityLocations.activityId),
    )
    .where(
      and(
        eq(activities.serverId, serverId),
        sql`${activityLocations.id} IS NULL`,
        sql`${activities.shortOverview} LIKE '%IP%'`,
      ),
    );

  // Unique countries
  const countriesResult = await db
    .selectDistinct({ country: activityLocations.countryCode })
    .from(activityLocations)
    .innerJoin(activities, eq(activityLocations.activityId, activities.id))
    .where(
      and(
        eq(activities.serverId, serverId),
        eq(activityLocations.isPrivateIp, false),
      ),
    );

  // Unique cities
  const citiesResult = await db
    .selectDistinct({ city: activityLocations.city })
    .from(activityLocations)
    .innerJoin(activities, eq(activityLocations.activityId, activities.id))
    .where(
      and(
        eq(activities.serverId, serverId),
        eq(activityLocations.isPrivateIp, false),
        sql`${activityLocations.city} IS NOT NULL`,
      ),
    );

  // Users with fingerprints
  const fingerprintsResult = await db
    .select({ count: count() })
    .from(userFingerprints)
    .where(eq(userFingerprints.serverId, serverId));

  // Unresolved anomalies by severity
  const anomaliesResult = await db
    .select({
      severity: anomalyEvents.severity,
      count: count(),
    })
    .from(anomalyEvents)
    .where(
      and(
        eq(anomalyEvents.serverId, serverId),
        eq(anomalyEvents.resolved, false),
      ),
    )
    .groupBy(anomalyEvents.severity);

  // Check if backfill job is running
  const isBackfillRunning = await isBackfillJobRunning(serverId);

  return {
    totalLocatedActivities: Number(totalLocatedResult[0]?.count || 0),
    pendingActivities: Number(pendingResult[0]?.count || 0),
    uniqueCountries: countriesResult.length,
    uniqueCities: citiesResult.length,
    usersWithFingerprints: Number(fingerprintsResult[0]?.count || 0),
    unresolvedAnomalies: Object.fromEntries(
      anomaliesResult.map((a) => [a.severity, Number(a.count)]),
    ),
    isBackfillRunning,
  };
}
