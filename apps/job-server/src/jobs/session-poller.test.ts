import { describe, expect, test } from "bun:test";
import { SessionPoller } from "./session-poller";
import type { TrackedSession } from "../jellyfin/types";

function createMockTrackedSession(overrides: Partial<TrackedSession> = {}): TrackedSession {
  const now = new Date();
  return {
    sessionKey: "test-session",
    userJellyfinId: "user-1",
    userName: "TestUser",
    sessionId: "jellyfin-session-1",
    itemId: "item-1",
    itemName: "Test Movie",
    positionTicks: 10_000_000,
    runtimeTicks: 600_000_000,
    playDuration: 100,
    startTime: new Date(now.getTime() - 120_000),
    lastUpdateTime: new Date(now.getTime() - 5_000), // 5s ago
    isPaused: false,
    ...overrides,
  };
}

describe("SessionPoller duration calculation and clamping", () => {
  const poller = new SessionPoller();

  test("calculateDuration adds elapsed time when playing normally", () => {
    const lastUpdate = new Date(Date.now() - 5_000); // 5 seconds ago
    const session = createMockTrackedSession({
      playDuration: 100,
      lastUpdateTime: lastUpdate,
      isPaused: false,
    });

    const duration = poller.calculateDuration(session, false);
    // Should add ~5 seconds (within 1s margin for test execution time)
    expect(duration).toBeGreaterThanOrEqual(105);
    expect(duration).toBeLessThanOrEqual(106);
  });

  test("calculateDuration does not add time when paused", () => {
    const lastUpdate = new Date(Date.now() - 10_000);
    const session = createMockTrackedSession({
      playDuration: 100,
      lastUpdateTime: lastUpdate,
      isPaused: true,
    });

    const duration = poller.calculateDuration(session, true);
    expect(duration).toBe(100);
  });

  test("calculateDuration clamps elapsed time across large gaps (e.g. 1 hour poll gap / crash)", () => {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000); // 3600 seconds ago
    const session = createMockTrackedSession({
      playDuration: 100,
      lastUpdateTime: oneHourAgo,
      isPaused: false,
    });

    const duration = poller.calculateDuration(session, false);
    // Max gap clamp for default 5s interval is 15s
    expect(duration).toBe(115);
  });

  test("getFinalDuration adds elapsed time when playing", () => {
    const now = new Date();
    const lastUpdate = new Date(now.getTime() - 4_000); // 4 seconds ago
    const session = createMockTrackedSession({
      playDuration: 100,
      lastUpdateTime: lastUpdate,
      isPaused: false,
    });

    const duration = poller.getFinalDuration(session, now);
    expect(duration).toBe(104);
  });

  test("getFinalDuration does not add time when paused", () => {
    const now = new Date();
    const lastUpdate = new Date(now.getTime() - 10_000);
    const session = createMockTrackedSession({
      playDuration: 100,
      lastUpdateTime: lastUpdate,
      isPaused: true,
    });

    const duration = poller.getFinalDuration(session, now);
    expect(duration).toBe(100);
  });

  test("getFinalDuration clamps elapsed time across large gaps (e.g. downtime / crash)", () => {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 7200 * 1000);
    const session = createMockTrackedSession({
      playDuration: 100,
      lastUpdateTime: twoHoursAgo,
      isPaused: false,
    });

    const duration = poller.getFinalDuration(session, now);
    // Clamped to maxGapSeconds (15s)
    expect(duration).toBe(115);
  });
});
