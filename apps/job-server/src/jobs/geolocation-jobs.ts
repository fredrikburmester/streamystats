import {
  db,
  getMergedUserTarget,
  activities,
  activityLocations,
  sessions,
  userFingerprints,
  anomalyEvents,
  type NewActivityLocation,
  type NewUserFingerprint,
  type NewAnomalyEvent,
} from "@streamystats/database";
import { eq, and, isNull, desc, sql } from "drizzle-orm";
import {
  geolocateIp,
  checkImpossibleTravel,
  parseIpFromShortOverview,
  getDeviceOrClientFromActivity,
} from "../services/geolocation";
import { publishJobEvent, nowIsoMicroUtc } from "../events/job-events";

const JOB_NAMES = {
  GEOLOCATE_ACTIVITIES: "geolocate-activities",
  CALCULATE_FINGERPRINTS: "calculate-fingerprints",
  DETECT_ANOMALIES: "detect-anomalies",
  BACKFILL_LOCATIONS: "backfill-activity-locations",
} as const;

export { JOB_NAMES as GEOLOCATION_JOB_NAMES };

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Geolocate activities that don't have location data yet.
 * Processes activities in batches for a specific server.
 */
export async function geolocateActivitiesJob(job: {
  data: { serverId: number; batchSize?: number };
}) {
  const { serverId, batchSize = 100 } = job.data;
  const startTime = Date.now();

  console.log(
    `[geolocation] action=start serverId=${serverId} batchSize=${batchSize}`
  );

  try {
    // Find activities without location data that have IP in shortOverview
    const activitiesWithoutLocation = await db
      .select({
        id: activities.id,
        shortOverview: activities.shortOverview,
        userId: activities.userId,
        date: activities.date,
        type: activities.type,
        name: activities.name,
      })
      .from(activities)
      .leftJoin(
        activityLocations,
        eq(activities.id, activityLocations.activityId)
      )
      .where(
        and(
          eq(activities.serverId, serverId),
          isNull(activityLocations.id),
          sql`${activities.shortOverview} IS NOT NULL`,
          sql`${activities.shortOverview} LIKE '%IP%'`
        )
      )
      .limit(batchSize);

    if (activitiesWithoutLocation.length === 0) {
      console.log(
        `[geolocation] action=complete serverId=${serverId} processed=0 reason=no-activities`
      );
      return { processed: 0, anomalies: 0 };
    }

    let processedCount = 0;
    let anomalyCount = 0;
    const locationRecords: NewActivityLocation[] = [];

    for (const activity of activitiesWithoutLocation) {
      const ipAddress = parseIpFromShortOverview(activity.shortOverview);

      if (!ipAddress) {
        // No IP found, create a record marking it as processed with no geo data
        locationRecords.push({
          activityId: activity.id,
          ipAddress: "unknown",
          isPrivateIp: true,
        });
        processedCount++;
        continue;
      }

      const { geo, isPrivateIp } = geolocateIp(ipAddress);

      const locationRecord: NewActivityLocation = {
        activityId: activity.id,
        ipAddress,
        countryCode: geo.countryCode,
        country: geo.country,
        region: geo.region,
        city: geo.city,
        latitude: geo.latitude,
        longitude: geo.longitude,
        timezone: geo.timezone,
        isPrivateIp,
      };

      locationRecords.push(locationRecord);
      processedCount++;

      // Check for anomalies if we have a userId and valid geo data
      if (activity.userId && geo.countryCode && !isPrivateIp) {
        const anomaly = await checkActivityAnomaly({
          serverId,
          sourceUserId: activity.userId,
          activityId: activity.id,
          geo,
          activityDate: activity.date,
          activityName: activity.name,
          activityType: activity.type,
        });
        if (anomaly) {
          anomalyCount++;
        }
      }
    }

    // Batch insert location records
    if (locationRecords.length > 0) {
      await db.insert(activityLocations).values(locationRecords);
    }

    const duration = Date.now() - startTime;
    console.log(
      `[geolocation] action=complete serverId=${serverId} processed=${processedCount} anomalies=${anomalyCount} durationMs=${duration}`
    );

    return { processed: processedCount, anomalies: anomalyCount };
  } catch (error) {
    console.error(`[geolocation] action=error serverId=${serverId}`, error);
    throw error;
  }
}

/**
 * Check an activity for anomalies against the user's fingerprint
 */
type ActivityAnomalyInput = {
  serverId: number;
  sourceUserId: string;
  activityId: string;
  geo: {
    countryCode: string | null;
    country: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  activityDate: Date;
  activityName: string;
  activityType: string;
};

async function checkActivityAnomaly(
  input: ActivityAnomalyInput
): Promise<NewAnomalyEvent | null> {
  const detected = await db.transaction(async (database) => {
    // Keep ownership and the security baseline stable until detection commits.
    await database.execute(
      sql`SELECT pg_advisory_xact_lock_shared(582, ${input.serverId})`
    );
    const userId = (await getMergedUserTarget({
      serverId: input.serverId, userId: input.sourceUserId, database,
    })) ?? input.sourceUserId;
    return detectActivityAnomalies({ ...input, userId, database });
  });
  for (const anomaly of detected) {
    publishJobEvent({
      type: "anomaly_detected",
      serverId: input.serverId,
      timestamp: nowIsoMicroUtc(),
      data: {
        anomalyType: anomaly.anomalyType,
        severity: anomaly.severity,
        userId: anomaly.userId,
      },
    });
  }
  return detected[0] ?? null;
}

async function detectActivityAnomalies({
  serverId, userId, activityId, geo, activityDate, activityName, activityType, database,
}: Omit<ActivityAnomalyInput, "sourceUserId"> & {
  userId: string;
  database: Transaction;
}): Promise<NewAnomalyEvent[]> {
  const dbFingerprint = await database.query.userFingerprints.findFirst({
    where: and(
      eq(userFingerprints.userId, userId),
      eq(userFingerprints.serverId, serverId)
    ),
  });
  const fingerprint = dbFingerprint ? {
    knownCountries: dbFingerprint.knownCountries ?? [],
    knownCities: dbFingerprint.knownCities ?? [],
    knownDeviceIds: dbFingerprint.knownDeviceIds ?? [],
  } : null;

  // Get device/client from activity name (primary source - always available)
  const deviceFromActivity = getDeviceOrClientFromActivity(
    activityName,
    activityType
  );

  // Get user's most recent session as fallback for additional context
  const recentSession = await database
    .select({
      deviceId: sessions.deviceId,
      deviceName: sessions.deviceName,
      clientName: sessions.clientName,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.serverId, serverId)))
    .orderBy(desc(sessions.startTime))
    .limit(1);

  // Get user's most recent geolocated activity (excluding current)
  const recentActivity = await database
    .select({
      activityId: activityLocations.activityId,
      latitude: activityLocations.latitude,
      longitude: activityLocations.longitude,
      country: activityLocations.country,
      city: activityLocations.city,
      activityDate: activities.date,
    })
    .from(activityLocations)
    .innerJoin(activities, eq(activityLocations.activityId, activities.id))
    .where(
      and(
        eq(activities.userId, userId),
        eq(activities.serverId, serverId),
        sql`${activityLocations.activityId} != ${activityId}`,
        eq(activityLocations.isPrivateIp, false)
      )
    )
    .orderBy(desc(activities.date))
    .limit(1);

  const anomalies: NewAnomalyEvent[] = [];

  // Check for impossible travel
  const prevActivity = recentActivity[0];
  if (
    prevActivity &&
    geo.latitude !== null &&
    geo.longitude !== null &&
    prevActivity.latitude !== null &&
    prevActivity.longitude !== null &&
    activityDate &&
    prevActivity.activityDate
  ) {
    const prevLat = prevActivity.latitude as number;
    const prevLng = prevActivity.longitude as number;
    const curLat = geo.latitude;
    const curLng = geo.longitude;
    // Use actual activity times for proper time diff calculation
    const timeDiffMinutes =
      (activityDate.getTime() - prevActivity.activityDate.getTime()) /
      (1000 * 60);

    const impossibleTravel = checkImpossibleTravel(
      prevLat,
      prevLng,
      curLat,
      curLng,
      timeDiffMinutes
    );

    if (impossibleTravel) {
      // Only flag as impossible if the current activity is actually after the previous one
      // (to avoid false positives from backfill processing order)
      if (timeDiffMinutes > 0) {
        const anomaly: NewAnomalyEvent = {
          userId,
          serverId,
          activityId,
          anomalyType: "impossible_travel",
          severity: "critical",
          details: {
            description: `Impossible travel detected: ${impossibleTravel.distanceKm.toFixed(
              0
            )} km in ${timeDiffMinutes.toFixed(
              0
            )} minutes (${impossibleTravel.speedKmh.toFixed(0)} km/h)`,
            previousLocation: {
              country: prevActivity.country || "",
              city: prevActivity.city,
              latitude: prevActivity.latitude,
              longitude: prevActivity.longitude,
              activityId: prevActivity.activityId,
              activityTime: prevActivity.activityDate?.toISOString(),
            },
            currentLocation: {
              country: geo.country || "",
              city: geo.city,
              latitude: geo.latitude,
              longitude: geo.longitude,
              activityId,
              activityTime: activityDate?.toISOString(),
            },
            distanceKm: impossibleTravel.distanceKm,
            timeDiffMinutes,
            speedKmh: impossibleTravel.speedKmh,
            previousActivityId: prevActivity.activityId,
          },
        };
        anomalies.push(anomaly);
      }
    }
  }

  // Get device label from activity name or fall back to session device
  // Define here so it's available in both fingerprint branches
  const deviceLabel = deviceFromActivity || recentSession[0]?.deviceName;
  const sessionDeviceId = recentSession[0]?.deviceId;

  // Check fingerprint-based anomalies
  if (fingerprint) {
    const { knownCountries, knownCities, knownDeviceIds } = fingerprint;

    const isNewCountry =
      geo.countryCode && !knownCountries.includes(geo.countryCode);

    if (isNewCountry) {
      // New country = medium severity
      anomalies.push({
        userId,
        serverId,
        activityId,
        anomalyType: "new_country",
        severity: "medium",
        details: {
          description: `First access from ${geo.country}`,
          currentLocation: {
            country: geo.country || "",
            city: geo.city,
            latitude: geo.latitude,
            longitude: geo.longitude,
          },
        },
      });
    } else if (geo.city && !knownCities.includes(geo.city)) {
      // New city (but known country) = low severity
      anomalies.push({
        userId,
        serverId,
        activityId,
        anomalyType: "new_location",
        severity: "low",
        details: {
          description: `First access from ${geo.city}, ${geo.country}`,
          currentLocation: {
            country: geo.country || "",
            city: geo.city,
            latitude: geo.latitude,
            longitude: geo.longitude,
          },
        },
      });
    }

    // Check for new device using parsed device/client name from activity

    if (deviceLabel) {
      // Normalize device label for comparison (handle extra spaces, case)
      const normalizedDevice = deviceLabel.trim().toLowerCase();
      const isKnownDevice = knownDeviceIds.some(
        (id) => id.toLowerCase() === normalizedDevice
      );

      if (!isKnownDevice) {
        anomalies.push({
          userId,
          serverId,
          activityId,
          anomalyType: "new_device",
          severity: "medium",
          details: {
            description: `First access from device: ${deviceLabel}`,
            // Keep deviceId as opaque identifier from session, deviceLabel as human-readable
            deviceId: sessionDeviceId ?? normalizedDevice,
            deviceName: deviceLabel,
            clientName: recentSession[0]?.clientName ?? undefined,
            currentLocation: {
              country: geo.country || "",
              city: geo.city,
              latitude: geo.latitude,
              longitude: geo.longitude,
            },
          },
        });
      }
    }

    // Immediately update fingerprint with new locations/devices to prevent duplicates
    // This ensures subsequent activities from the same location won't trigger new anomalies
    if (anomalies.length > 0) {
      const updatedCountries = [...knownCountries];
      const updatedCities = [...knownCities];
      const updatedDeviceIds = [...knownDeviceIds];

      for (const anomaly of anomalies) {
        if (anomaly.anomalyType === "new_country" && geo.countryCode) {
          if (!updatedCountries.includes(geo.countryCode)) {
            updatedCountries.push(geo.countryCode);
          }
        }
        if (anomaly.anomalyType === "new_location" && geo.city) {
          if (!updatedCities.includes(geo.city)) {
            updatedCities.push(geo.city);
          }
        }
        if (anomaly.anomalyType === "new_device" && anomaly.details.deviceName) {
          // Store normalized device label for consistent matching
          const normalizedLabel = String(anomaly.details.deviceName)
            .trim()
            .toLowerCase();
          if (!updatedDeviceIds.includes(normalizedLabel)) {
            updatedDeviceIds.push(normalizedLabel);
          }
        }
      }

      // Persist new baseline entries for subsequent activities
      await database
        .update(userFingerprints)
        .set({
          knownCountries: updatedCountries,
          knownCities: updatedCities,
          knownDeviceIds: updatedDeviceIds,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userFingerprints.userId, userId),
            eq(userFingerprints.serverId, serverId)
          )
        );
    }
  } else if (geo.countryCode) {
    await createInitialFingerprint({ serverId, userId, geo, deviceLabel, database });
  }

  // The caller publishes events after this transaction commits.
  if (anomalies.length > 0) {
    await database.insert(anomalyEvents).values(anomalies);
    console.log(
      `[anomaly] userId=${userId} count=${anomalies.length} types=${anomalies
        .map((a) => a.anomalyType)
        .join(",")}`
    );
  }
  return anomalies;
}

/**
 * Create initial fingerprint for a user
 */
async function createInitialFingerprint({
  serverId, userId, geo, deviceLabel = null, database,
}: {
  serverId: number;
  userId: string;
  geo: {
    countryCode: string | null;
    country: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  deviceLabel?: string | null;
  database: Transaction;
}): Promise<void> {
  const now = new Date().toISOString();
  // Normalize for matching, keep original for display
  const normalizedDevice = deviceLabel?.trim().toLowerCase() ?? null;

  const fingerprint: NewUserFingerprint = {
    userId,
    serverId,
    knownCountries: geo.countryCode ? [geo.countryCode] : [],
    knownCities: geo.city ? [geo.city] : [],
    // Store normalized device labels for consistent matching
    knownDeviceIds: normalizedDevice ? [normalizedDevice] : [],
    knownClients: [],
    locationPatterns: geo.countryCode
      ? [
          {
            country: geo.countryCode,
            city: geo.city,
            latitude: geo.latitude,
            longitude: geo.longitude,
            sessionCount: 1,
            lastSeenAt: now,
          },
        ]
      : [],
    devicePatterns: deviceLabel && normalizedDevice
      ? [
          {
            deviceId: normalizedDevice,
            deviceName: deviceLabel, // Keep original casing for display
            clientName: null,
            sessionCount: 1,
            lastSeenAt: now,
          },
        ]
      : [],
    totalSessions: 1,
    lastCalculatedAt: new Date(),
  };

  await database.insert(userFingerprints).values(fingerprint).onConflictDoNothing();
}

/**
 * Calculate/update fingerprints for all users on a server.
 * Should be run periodically to keep fingerprints up-to-date.
 */
export async function calculateFingerprintsJob(job: {
  data: { serverId: number };
}) {
  const { serverId } = job.data;
  const startTime = Date.now();

  console.log(`[fingerprint] action=start serverId=${serverId}`);

  try {
    // Get all users with activities on this server
    const usersWithActivities = await db
      .selectDistinct({ userId: activities.userId })
      .from(activities)
      .where(
        and(
          eq(activities.serverId, serverId),
          sql`${activities.userId} IS NOT NULL`
        )
      );

    const userIds = usersWithActivities
      .map((u) => u.userId)
      .filter((id): id is string => id !== null);

    if (userIds.length === 0) {
      console.log(`[fingerprint] action=complete serverId=${serverId} users=0`);
      return { usersProcessed: 0 };
    }

    let processedCount = 0;

    for (const userId of userIds) {
      await db.transaction(async (database) => {
        await database.execute(sql`SELECT pg_advisory_xact_lock_shared(582, ${serverId})`);
        await calculateUserFingerprint({ serverId, userId, database });
      });
      processedCount++;
    }

    const duration = Date.now() - startTime;
    console.log(
      `[fingerprint] action=complete serverId=${serverId} users=${processedCount} durationMs=${duration}`
    );

    return { usersProcessed: processedCount };
  } catch (error) {
    console.error(`[fingerprint] action=error serverId=${serverId}`, error);
    throw error;
  }
}

/**
 * Calculate fingerprint for a single user
 */
async function calculateUserFingerprint({
  serverId, userId, database,
}: {
  serverId: number;
  userId: string;
  database: Transaction;
}): Promise<void> {
  // Get all activities with location data for this user
  const userActivities = await database
    .select({
      activityId: activities.id,
      date: activities.date,
      type: activities.type,
      name: activities.name,
      countryCode: activityLocations.countryCode,
      country: activityLocations.country,
      city: activityLocations.city,
      latitude: activityLocations.latitude,
      longitude: activityLocations.longitude,
    })
    .from(activities)
    .leftJoin(
      activityLocations,
      eq(activities.id, activityLocations.activityId)
    )
    .where(
      and(eq(activities.userId, userId), eq(activities.serverId, serverId))
    );

  // Get device data from sessions
  const userSessions = await database
    .select({
      deviceId: sessions.deviceId,
      deviceName: sessions.deviceName,
      clientName: sessions.clientName,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), eq(sessions.serverId, serverId)));

  if (userActivities.length === 0 && userSessions.length === 0) return;

  // Aggregate patterns
  const countrySet = new Set<string>();
  const citySet = new Set<string>();
  const hourHistogram: Record<number, number> = {};
  const deviceIdSet = new Set<string>();
  const clientSet = new Set<string>();

  const locationMap = new Map<
    string,
    {
      country: string;
      city: string | null;
      latitude: number | null;
      longitude: number | null;
      sessionCount: number;
      lastSeenAt: string;
    }
  >();

  const deviceMap = new Map<
    string,
    {
      deviceId: string;
      deviceName: string | null;
      clientName: string | null;
      sessionCount: number;
      lastSeenAt: string;
    }
  >();

  for (const activity of userActivities) {
    // Location patterns
    if (activity.countryCode) {
      countrySet.add(activity.countryCode);
      const locationKey = `${activity.countryCode}:${
        activity.city || "unknown"
      }`;
      const existing = locationMap.get(locationKey);
      const activityTime =
        activity.date?.toISOString() || new Date().toISOString();

      if (existing) {
        existing.sessionCount++;
        if (activityTime > existing.lastSeenAt) {
          existing.lastSeenAt = activityTime;
        }
      } else {
        locationMap.set(locationKey, {
          country: activity.countryCode,
          city: activity.city,
          latitude: activity.latitude,
          longitude: activity.longitude,
          sessionCount: 1,
          lastSeenAt: activityTime,
        });
      }
    }

    if (activity.city) citySet.add(activity.city);

    // Time patterns - build histogram with counts
    if (activity.date) {
      const hour = activity.date.getUTCHours();
      hourHistogram[hour] = (hourHistogram[hour] || 0) + 1;
    }

    // Device patterns from activity name (more reliable than sessions)
    const deviceFromActivity = getDeviceOrClientFromActivity(
      activity.name,
      activity.type
    );
    if (deviceFromActivity) {
      // Normalize device label for consistent matching
      const normalizedDevice = deviceFromActivity.trim().toLowerCase();
      deviceIdSet.add(normalizedDevice);
      const activityTime =
        activity.date?.toISOString() || new Date().toISOString();
      const existing = deviceMap.get(normalizedDevice);
      if (existing) {
        existing.sessionCount++;
        if (activityTime > existing.lastSeenAt) {
          existing.lastSeenAt = activityTime;
        }
      } else {
        deviceMap.set(normalizedDevice, {
          deviceId: normalizedDevice,
          deviceName: deviceFromActivity, // Keep original for display
          clientName: null,
          sessionCount: 1,
          lastSeenAt: activityTime,
        });
      }
    }
  }

  // Aggregate device data from sessions (fallback for activities without device in name)
  for (const session of userSessions) {
    // Prefer deviceName over deviceId for human-readable labels, then normalize
    const deviceLabel = session.deviceName || session.deviceId;
    if (deviceLabel) {
      const normalizedDevice = deviceLabel.trim().toLowerCase();
      // Only add if we don't already have this device from activity parsing
      if (!deviceIdSet.has(normalizedDevice)) {
        deviceIdSet.add(normalizedDevice);
        deviceMap.set(normalizedDevice, {
          deviceId: normalizedDevice,
          deviceName: session.deviceName || session.deviceId,
          clientName: session.clientName,
          sessionCount: 1,
          lastSeenAt: new Date().toISOString(),
        });
      }
    }
    if (session.clientName) clientSet.add(session.clientName);
  }

  // Calculate avg activities per day
  const activityDates = new Set(
    userActivities
      .filter((a) => a.date)
      .map((a) => a.date.toISOString().split("T")[0])
  );
  const avgSessionsPerDay =
    activityDates.size > 0 ? userActivities.length / activityDates.size : 0;

  const fingerprintData: NewUserFingerprint = {
    userId,
    serverId,
    knownCountries: Array.from(countrySet),
    knownCities: Array.from(citySet),
    knownDeviceIds: Array.from(deviceIdSet),
    knownClients: Array.from(clientSet),
    locationPatterns: Array.from(locationMap.values()),
    devicePatterns: Array.from(deviceMap.values()),
    hourHistogram,
    avgSessionsPerDay,
    totalSessions: userActivities.length,
    lastCalculatedAt: new Date(),
  };

  // Upsert fingerprint
  await database
    .insert(userFingerprints)
    .values(fingerprintData)
    .onConflictDoUpdate({
      target: [userFingerprints.userId, userFingerprints.serverId],
      set: {
        knownCountries: fingerprintData.knownCountries,
        knownCities: fingerprintData.knownCities,
        knownDeviceIds: fingerprintData.knownDeviceIds,
        knownClients: fingerprintData.knownClients,
        locationPatterns: fingerprintData.locationPatterns,
        devicePatterns: fingerprintData.devicePatterns,
        hourHistogram: fingerprintData.hourHistogram,
        avgSessionsPerDay: fingerprintData.avgSessionsPerDay,
        totalSessions: fingerprintData.totalSessions,
        lastCalculatedAt: fingerprintData.lastCalculatedAt,
        updatedAt: new Date(),
      },
    });
}

/**
 * Backfill location data for all existing activities that don't have it.
 * Useful for initial setup or after enabling location tracking.
 */
export async function backfillActivityLocationsJob(job: {
  data: { serverId: number; batchSize?: number };
}) {
  const { serverId, batchSize = 500 } = job.data;
  const startTime = Date.now();

  console.log(
    `[backfill-locations] action=start serverId=${serverId} batchSize=${batchSize}`
  );

  try {
    let totalProcessed = 0;
    let hasMore = true;

    // Publish job started event
    publishJobEvent({
      type: "started",
      jobName: JOB_NAMES.BACKFILL_LOCATIONS,
      serverId,
      timestamp: nowIsoMicroUtc(),
    });

    while (hasMore) {
      const result = await geolocateActivitiesJob({
        data: { serverId, batchSize },
      });

      totalProcessed += result.processed;

      // Publish progress event
      publishJobEvent({
        type: "progress",
        jobName: JOB_NAMES.BACKFILL_LOCATIONS,
        serverId,
        progress: { current: totalProcessed },
        timestamp: nowIsoMicroUtc(),
      });

      // If we processed less than the batch size, we're done
      hasMore = result.processed === batchSize;

      // Prevent infinite loops
      if (totalProcessed > 100000) {
        console.log(
          `[backfill-locations] action=safety-limit serverId=${serverId} processed=${totalProcessed}`
        );
        break;
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[backfill-locations] action=complete serverId=${serverId} totalProcessed=${totalProcessed} durationMs=${duration}`
    );

    // Publish job completed event
    publishJobEvent({
      type: "completed",
      jobName: JOB_NAMES.BACKFILL_LOCATIONS,
      serverId,
      data: { totalProcessed },
      timestamp: nowIsoMicroUtc(),
    });

    return { totalProcessed };
  } catch (error) {
    console.error(
      `[backfill-locations] action=error serverId=${serverId}`,
      error
    );

    // Publish job failed event
    publishJobEvent({
      type: "failed",
      jobName: JOB_NAMES.BACKFILL_LOCATIONS,
      serverId,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: nowIsoMicroUtc(),
    });

    throw error;
  }
}
