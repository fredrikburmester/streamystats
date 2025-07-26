import { basePath } from "@/lib/utils";
import crypto from "crypto";

const manifest = {
  name: "Streamystats",
  short_name: "Streamystats",
  description: "A statistics service for Jellyfin.",
  start_url: `${basePath}/`,
  scope: `${basePath}/`,
  display: "standalone",
  background_color: "#000",
  theme_color: "#1C4ED8",
  icons: [
    {
      src: `${basePath}/web-app-manifest-192x192.png`,
      sizes: "192x192",
      type: "image/png",
    },
    {
      src: `${basePath}/web-app-manifest-512x512.png`,
      sizes: "512x512",
      type: "image/png",
    },
  ],
};

const manifestJson = JSON.stringify(manifest);
const etag = crypto.createHash("sha1").update(manifestJson).digest("hex");

const headers = {
  "Content-Type": "application/manifest+json",
  "Cache-Control": "public, max-age=604800", // cache for 7 days
  ETag: `"${etag}"`,
};

export function GET(request: Request) {
  const ifNoneMatch = request.headers.get("if-none-match");

  if (ifNoneMatch === `"${etag}"`) {
    return new Response(null, {
      status: 304,
      headers,
    });
  }

  return new Response(manifestJson, {
    status: 200,
    headers,
  });
}

export function HEAD(request: Request) {
  const ifNoneMatch = request.headers.get("if-none-match");

  if (ifNoneMatch === `"${etag}"`) {
    return new Response(null, {
      status: 304,
      headers,
    });
  }

  return new Response(null, {
    status: 200,
    headers,
  });
}
