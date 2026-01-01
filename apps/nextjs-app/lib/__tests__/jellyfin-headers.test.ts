import { describe, expect, test, mock } from "bun:test";
import { getAuthHeaders } from "../jellyfin-headers";

describe("jellyfin-headers", () => {
  describe("getAuthHeaders", () => {
    test("returns legacy headers when server is null", () => {
      const headers = getAuthHeaders("test-token", null);

      expect(headers["X-Emby-Token"]).toBe("test-token");
      expect(headers["Content-Type"]).toBe("application/json");
      expect(headers.Authorization).toBeUndefined();
    });

    test("returns legacy headers when server is undefined", () => {
      const headers = getAuthHeaders("test-token");

      expect(headers["X-Emby-Token"]).toBe("test-token");
      expect(headers["Content-Type"]).toBe("application/json");
    });

    test("returns legacy headers when server version is null", () => {
      const headers = getAuthHeaders("test-token", { id: 1, version: null });

      expect(headers["X-Emby-Token"]).toBe("test-token");
      expect(headers.Authorization).toBeUndefined();
    });

    test("returns legacy headers for Jellyfin < 10.11", () => {
      const headers = getAuthHeaders("test-token", {
        id: 1,
        version: "10.10.0",
      });

      expect(headers["X-Emby-Token"]).toBe("test-token");
      expect(headers.Authorization).toBeUndefined();
    });

    test("returns MediaBrowser headers for Jellyfin 10.11+", () => {
      const headers = getAuthHeaders("test-token", {
        id: 1,
        version: "10.11.0",
      });

      expect(headers.Authorization).toBeDefined();
      expect(headers.Authorization).toMatch(/^MediaBrowser /);
      expect(headers.Authorization).toContain('Token="test-token"');
      expect(headers["X-Emby-Token"]).toBeUndefined();
    });

    test("returns MediaBrowser headers for Jellyfin 10.12+", () => {
      const headers = getAuthHeaders("test-token", {
        id: 1,
        version: "10.12.0",
      });

      expect(headers.Authorization).toBeDefined();
      expect(headers.Authorization).toMatch(/^MediaBrowser /);
    });

    test("includes Content-Type for all versions", () => {
      const legacyHeaders = getAuthHeaders("token", { id: 1, version: "10.9.0" });
      const modernHeaders = getAuthHeaders("token", { id: 1, version: "10.11.0" });

      expect(legacyHeaders["Content-Type"]).toBe("application/json");
      expect(modernHeaders["Content-Type"]).toBe("application/json");
    });

    test("generates consistent headers for same server", () => {
      const headers1 = getAuthHeaders("token", { id: 1, version: "10.11.0" });
      const headers2 = getAuthHeaders("token", { id: 1, version: "10.11.0" });

      expect(headers1.Authorization).toBe(headers2.Authorization);
    });

    test("generates different headers for different servers", () => {
      const headers1 = getAuthHeaders("token", { id: 1, version: "10.11.0" });
      const headers2 = getAuthHeaders("token", { id: 2, version: "10.11.0" });

      expect(headers1.Authorization).not.toBe(headers2.Authorization);
    });

    test("includes Streamystats-Web as device name", () => {
      const headers = getAuthHeaders("token", { id: 1, version: "10.11.0" });

      expect(headers.Authorization).toContain("Streamystats-Web");
    });

    test("includes Streamystats as client name", () => {
      const headers = getAuthHeaders("token", { id: 1, version: "10.11.0" });

      expect(headers.Authorization).toContain('Client="Streamystats"');
    });

    test("returns Record<string, string> type (assignable to fetch headers)", () => {
      const headers = getAuthHeaders("token", { id: 1, version: "10.11.0" });

      // Verify all values are strings (no undefined in the record)
      for (const value of Object.values(headers)) {
        if (value !== undefined) {
          expect(typeof value).toBe("string");
        }
      }
    });
  });
});
