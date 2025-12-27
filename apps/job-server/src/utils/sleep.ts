const MAX_TIMEOUT_MS = 2_147_483_647; // setTimeout max on most JS runtimes (2^31 - 1)

export function normalizeTimeoutMs(ms: number): number {
  if (!Number.isFinite(ms)) return 0;
  return Math.min(MAX_TIMEOUT_MS, Math.max(0, Math.floor(ms)));
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, normalizeTimeoutMs(ms)));
}













