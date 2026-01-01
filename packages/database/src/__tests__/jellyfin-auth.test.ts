import { describe, expect, test } from "bun:test";
import {
  parseJellyfinVersion,
  supportsMediaBrowserAuth,
  generateDeviceId,
  buildMediaBrowserHeader,
  buildAuthHeaders,
  STREAMYSTATS_CLIENT,
  STREAMYSTATS_VERSION,
} from "../jellyfin-auth";

describe("jellyfin-auth", () => {
  describe("parseJellyfinVersion", () => {
    test("parses standard version string", () => {
      const result = parseJellyfinVersion("10.11.0");
      expect(result).toEqual({ major: 10, minor: 11, patch: 0 });
    });

    test("parses version with higher patch number", () => {
      const result = parseJellyfinVersion("10.9.11");
      expect(result).toEqual({ major: 10, minor: 9, patch: 11 });
    });

    test("parses version with only major.minor", () => {
      const result = parseJellyfinVersion("10.11");
      expect(result).toEqual({ major: 10, minor: 11, patch: 0 });
    });

    test("handles single number version", () => {
      const result = parseJellyfinVersion("10");
      expect(result).toEqual({ major: 10, minor: 0, patch: 0 });
    });

    test("handles empty string", () => {
      const result = parseJellyfinVersion("");
      expect(result).toEqual({ major: 0, minor: 0, patch: 0 });
    });

    test("handles non-numeric parts gracefully", () => {
      const result = parseJellyfinVersion("10.11.0-beta");
      expect(result).toEqual({ major: 10, minor: 11, patch: 0 });
    });
  });

  describe("supportsMediaBrowserAuth", () => {
    test("returns false for null version", () => {
      expect(supportsMediaBrowserAuth(null)).toBe(false);
    });

    test("returns false for version 10.10.x", () => {
      expect(supportsMediaBrowserAuth("10.10.0")).toBe(false);
      expect(supportsMediaBrowserAuth("10.10.5")).toBe(false);
    });

    test("returns false for version 10.9.x", () => {
      expect(supportsMediaBrowserAuth("10.9.0")).toBe(false);
      expect(supportsMediaBrowserAuth("10.9.11")).toBe(false);
    });

    test("returns true for version 10.11.0", () => {
      expect(supportsMediaBrowserAuth("10.11.0")).toBe(true);
    });

    test("returns true for version 10.11.x", () => {
      expect(supportsMediaBrowserAuth("10.11.1")).toBe(true);
      expect(supportsMediaBrowserAuth("10.11.5")).toBe(true);
    });

    test("returns true for version 10.12.x and higher minor", () => {
      expect(supportsMediaBrowserAuth("10.12.0")).toBe(true);
      expect(supportsMediaBrowserAuth("10.15.0")).toBe(true);
    });

    test("returns true for version 11.x.x (major version 11+)", () => {
      expect(supportsMediaBrowserAuth("11.0.0")).toBe(true);
      expect(supportsMediaBrowserAuth("11.5.0")).toBe(true);
    });

    test("returns true for higher major versions", () => {
      expect(supportsMediaBrowserAuth("12.0.0")).toBe(true);
    });
  });

  describe("generateDeviceId", () => {
    test("generates 32 character hex string", () => {
      const deviceId = generateDeviceId("web");
      expect(deviceId).toHaveLength(32);
      expect(deviceId).toMatch(/^[a-f0-9]{32}$/);
    });

    test("generates consistent ID for same input", () => {
      const id1 = generateDeviceId("web", 123);
      const id2 = generateDeviceId("web", 123);
      expect(id1).toBe(id2);
    });

    test("generates different IDs for different contexts", () => {
      const webId = generateDeviceId("web", 123);
      const jobServerId = generateDeviceId("job-server", 123);
      expect(webId).not.toBe(jobServerId);
    });

    test("generates different IDs for different server IDs", () => {
      const id1 = generateDeviceId("web", 1);
      const id2 = generateDeviceId("web", 2);
      expect(id1).not.toBe(id2);
    });

    test("handles string server ID", () => {
      const id1 = generateDeviceId("web", "server-1");
      const id2 = generateDeviceId("web", "server-1");
      expect(id1).toBe(id2);
    });

    test("uses 'global' when no server ID provided", () => {
      const idWithoutServer = generateDeviceId("web");
      const idWithGlobal = generateDeviceId("web", "global");
      expect(idWithoutServer).toBe(idWithGlobal);
    });
  });

  describe("buildMediaBrowserHeader", () => {
    test("builds header with all required fields", () => {
      const header = buildMediaBrowserHeader({
        token: "test-token-123",
      });

      expect(header).toContain('Token="test-token-123"');
      expect(header).toContain(`Client="${STREAMYSTATS_CLIENT}"`);
      expect(header).toContain(`Version="${STREAMYSTATS_VERSION}"`);
      expect(header).toContain("Device=");
      expect(header).toContain("DeviceId=");
      expect(header).toMatch(/^MediaBrowser /);
    });

    test("uses custom client name", () => {
      const header = buildMediaBrowserHeader({
        token: "token",
        client: "CustomClient",
      });

      expect(header).toContain('Client="CustomClient"');
    });

    test("uses custom device name", () => {
      const header = buildMediaBrowserHeader({
        token: "token",
        device: "MyDevice",
      });

      expect(header).toContain('Device="MyDevice"');
    });

    test("uses custom device ID", () => {
      const header = buildMediaBrowserHeader({
        token: "token",
        deviceId: "custom-device-id-123",
      });

      expect(header).toContain('DeviceId="custom-device-id-123"');
    });

    test("uses custom version", () => {
      const header = buildMediaBrowserHeader({
        token: "token",
        version: "1.0.0",
      });

      expect(header).toContain('Version="1.0.0"');
    });

    test("URL encodes special characters in token", () => {
      const header = buildMediaBrowserHeader({
        token: 'token"with"quotes',
      });

      expect(header).toContain('Token="token%22with%22quotes"');
    });
  });

  describe("buildAuthHeaders", () => {
    describe("with MediaBrowser auth (Jellyfin 10.11+)", () => {
      test("returns Authorization header for 10.11.0", () => {
        const headers = buildAuthHeaders("api-key-123", "10.11.0");

        expect(headers.Authorization).toBeDefined();
        expect(headers.Authorization).toMatch(/^MediaBrowser /);
        expect(headers["X-Emby-Token"]).toBeUndefined();
        expect(headers["Content-Type"]).toBe("application/json");
      });

      test("returns Authorization header for 10.12.0", () => {
        const headers = buildAuthHeaders("api-key-123", "10.12.0");

        expect(headers.Authorization).toBeDefined();
        expect(headers["X-Emby-Token"]).toBeUndefined();
      });

      test("includes token in MediaBrowser header", () => {
        const headers = buildAuthHeaders("my-secret-token", "10.11.0");

        expect(headers.Authorization).toContain('Token="my-secret-token"');
      });

      test("uses web context by default", () => {
        const headers = buildAuthHeaders("token", "10.11.0");

        expect(headers.Authorization).toContain("Streamystats-Web");
      });

      test("uses job-server context when specified", () => {
        const headers = buildAuthHeaders("token", "10.11.0", {
          appContext: "job-server",
        });

        // Job server uses hostname or fallback
        expect(headers.Authorization).toBeDefined();
      });

      test("generates consistent device ID for same server", () => {
        const headers1 = buildAuthHeaders("token", "10.11.0", { serverId: 1 });
        const headers2 = buildAuthHeaders("token", "10.11.0", { serverId: 1 });

        expect(headers1.Authorization).toBe(headers2.Authorization);
      });

      test("generates different device IDs for different servers", () => {
        const headers1 = buildAuthHeaders("token", "10.11.0", { serverId: 1 });
        const headers2 = buildAuthHeaders("token", "10.11.0", { serverId: 2 });

        expect(headers1.Authorization).not.toBe(headers2.Authorization);
      });
    });

    describe("with legacy auth (Jellyfin < 10.11)", () => {
      test("returns X-Emby-Token header for null version", () => {
        const headers = buildAuthHeaders("api-key-123", null);

        expect(headers["X-Emby-Token"]).toBe("api-key-123");
        expect(headers.Authorization).toBeUndefined();
        expect(headers["Content-Type"]).toBe("application/json");
      });

      test("returns X-Emby-Token header for 10.10.0", () => {
        const headers = buildAuthHeaders("api-key-123", "10.10.0");

        expect(headers["X-Emby-Token"]).toBe("api-key-123");
        expect(headers.Authorization).toBeUndefined();
      });

      test("returns X-Emby-Token header for 10.9.11", () => {
        const headers = buildAuthHeaders("api-key-123", "10.9.11");

        expect(headers["X-Emby-Token"]).toBe("api-key-123");
        expect(headers.Authorization).toBeUndefined();
      });
    });

    describe("Content-Type header", () => {
      test("always includes Content-Type: application/json", () => {
        const legacyHeaders = buildAuthHeaders("token", null);
        const modernHeaders = buildAuthHeaders("token", "10.11.0");

        expect(legacyHeaders["Content-Type"]).toBe("application/json");
        expect(modernHeaders["Content-Type"]).toBe("application/json");
      });
    });
  });

  describe("constants", () => {
    test("STREAMYSTATS_CLIENT is 'Streamystats'", () => {
      expect(STREAMYSTATS_CLIENT).toBe("Streamystats");
    });

    test("STREAMYSTATS_VERSION is defined", () => {
      expect(STREAMYSTATS_VERSION).toBeDefined();
      expect(STREAMYSTATS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
