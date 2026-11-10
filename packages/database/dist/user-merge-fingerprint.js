"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.combineUserFingerprints = combineUserFingerprints;
function combinePatterns({ patterns, key }) {
    const combined = new Map();
    for (const pattern of patterns) {
        const id = key(pattern);
        const previous = combined.get(id);
        if (!previous) {
            combined.set(id, pattern);
            continue;
        }
        const latest = Date.parse(pattern.lastSeenAt) > Date.parse(previous.lastSeenAt)
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
function combineUserFingerprints(fingerprints) {
    const unique = (field) => [
        ...new Set(fingerprints.flatMap((fingerprint) => fingerprint[field] ?? [])),
    ];
    const hourHistogram = {};
    for (const fingerprint of fingerprints) {
        for (const [hour, count] of Object.entries(fingerprint.hourHistogram ?? {})) {
            const key = Number(hour);
            hourHistogram[key] = (hourHistogram[key] ?? 0) + count;
        }
    }
    const dates = fingerprints.flatMap((fingerprint) => fingerprint.lastCalculatedAt
        ? [fingerprint.lastCalculatedAt.getTime()]
        : []);
    return {
        knownCountries: unique("knownCountries"),
        knownCities: unique("knownCities"),
        knownDeviceIds: unique("knownDeviceIds"),
        knownClients: unique("knownClients"),
        locationPatterns: combinePatterns({
            patterns: fingerprints.flatMap((fingerprint) => fingerprint.locationPatterns ?? []),
            key: (pattern) => JSON.stringify([pattern.country, pattern.city]),
        }),
        devicePatterns: combinePatterns({
            patterns: fingerprints.flatMap((fingerprint) => fingerprint.devicePatterns ?? []),
            key: (pattern) => pattern.deviceId.toLowerCase(),
        }),
        hourHistogram,
        totalSessions: fingerprints.reduce((total, fingerprint) => total + (fingerprint.totalSessions ?? 0), 0),
        lastCalculatedAt: dates.length === fingerprints.length && dates.length
            ? new Date(Math.min(...dates))
            : null,
        updatedAt: new Date(),
    };
}
//# sourceMappingURL=user-merge-fingerprint.js.map