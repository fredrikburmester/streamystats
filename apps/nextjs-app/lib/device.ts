/**
 * Parse a User-Agent string into a human-readable device name.
 * e.g. "Chrome on Windows", "Safari on iPhone", "Firefox on macOS"
 */
export function parseDeviceName(ua: string): string {
  const browser = parseBrowser(ua);
  const os = parseOS(ua);
  if (browser && os) return `${browser} on ${os}`;
  return browser || os || "Unknown Device";
}

function parseBrowser(ua: string): string | null {
  // Order matters — check specific browsers before generic engines
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("OPR/") || ua.includes("Opera")) return "Opera";
  if (ua.includes("Vivaldi/")) return "Vivaldi";
  if (ua.includes("Brave")) return "Brave";
  if (ua.includes("Chrome/") && ua.includes("Safari/")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  if (ua.includes("Safari/") && !ua.includes("Chrome/")) return "Safari";
  return null;
}

function parseOS(ua: string): string | null {
  if (ua.includes("iPhone")) return "iPhone";
  if (ua.includes("iPad")) return "iPad";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS X") || ua.includes("Macintosh")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("CrOS")) return "ChromeOS";
  return null;
}
