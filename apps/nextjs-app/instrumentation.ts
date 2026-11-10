export async function register() {
  // Resolve *_FILE secrets into process.env before the first request, so the
  // app and Next.js itself (NEXT_SERVER_ACTIONS_ENCRYPTION_KEY) see them.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@streamystats/database/load-env");
  }
}
