import type { userFingerprints } from "./schema";
type Fingerprint = typeof userFingerprints.$inferSelect;
export declare function combineUserFingerprints(fingerprints: Fingerprint[]): {
    knownCountries: string[];
    knownCities: string[];
    knownDeviceIds: string[];
    knownClients: string[];
    locationPatterns: {
        country: string;
        city: string | null;
        latitude: number | null;
        longitude: number | null;
        sessionCount: number;
        lastSeenAt: string;
    }[];
    devicePatterns: {
        deviceId: string;
        deviceName: string | null;
        clientName: string | null;
        sessionCount: number;
        lastSeenAt: string;
    }[];
    hourHistogram: Record<number, number>;
    totalSessions: number;
    lastCalculatedAt: Date | null;
    updatedAt: Date;
};
export {};
//# sourceMappingURL=user-merge-fingerprint.d.ts.map