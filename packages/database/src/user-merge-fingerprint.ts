import type { userFingerprints } from "./schema";

type Fingerprint = typeof userFingerprints.$inferSelect;

function combinePatterns<
  T extends { sessionCount: number; lastSeenAt: string },
>({ patterns, key }: { patterns: T[]; key: (pattern: T) => string }): T[] {
  const combined = new Map<string, T>();
  for (const pattern of patterns) {
    const id = key(pattern);
    const previous = combined.get(id);
    if (!previous) {
      combined.set(id, pattern);
      continue;
    }
    const latest =
      Date.parse(pattern.lastSeenAt) > Date.parse(previous.lastSeenAt)
        ? pattern
        : previous;
    combined.set(id, {
      ...latest,
      sessionCount: previous.sessionCount + pattern.sessionCount,
    });
  }
  return [...combined.values()];
}

// Preserve established security baselines immediately. The scheduled calculation
// can refresh derived statistics later without treating known locations as new.
export function combineUserFingerprints(fingerprints: Fingerprint[]) {
  const unique = (
    field: "knownCountries" | "knownCities" | "knownDeviceIds" | "knownClients",
  ) => [
    ...new Set(fingerprints.flatMap((fingerprint) => fingerprint[field] ?? [])),
  ];
  const hourHistogram: Record<number, number> = {};
  for (const fingerprint of fingerprints) {
    for (const [hour, count] of Object.entries(
      fingerprint.hourHistogram ?? {},
    )) {
      const key = Number(hour);
      hourHistogram[key] = (hourHistogram[key] ?? 0) + count;
    }
  }
  const dates = fingerprints.flatMap((fingerprint) =>
    fingerprint.lastCalculatedAt
      ? [fingerprint.lastCalculatedAt.getTime()]
      : [],
  );
  return {
    knownCountries: unique("knownCountries"),
    knownCities: unique("knownCities"),
    knownDeviceIds: unique("knownDeviceIds"),
    knownClients: unique("knownClients"),
    locationPatterns: combinePatterns({
      patterns: fingerprints.flatMap(
        (fingerprint) => fingerprint.locationPatterns ?? [],
      ),
      key: (pattern) => JSON.stringify([pattern.country, pattern.city]),
    }),
    devicePatterns: combinePatterns({
      patterns: fingerprints.flatMap(
        (fingerprint) => fingerprint.devicePatterns ?? [],
      ),
      key: (pattern) => pattern.deviceId.toLowerCase(),
    }),
    hourHistogram,
    totalSessions: fingerprints.reduce(
      (total, fingerprint) => total + (fingerprint.totalSessions ?? 0),
      0,
    ),
    lastCalculatedAt:
      dates.length === fingerprints.length && dates.length
        ? new Date(Math.min(...dates))
        : null,
    updatedAt: new Date(),
  };
}
