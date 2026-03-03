/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  deploymentId: process.env.DEPLOYMENT_ID,
  cacheComponents: true,
  images: {
    dangerouslyAllowLocalIP: true,
    // Broad remote patterns are required because Jellyfin servers are
    // self-hosted at arbitrary domains/IPs. The Next.js image optimizer
    // proxies album art and backdrops from whichever Jellyfin host the
    // user has configured, so we cannot restrict to a fixed allowlist.
    remotePatterns: [
      {
        protocol: "http",
        hostname: "*",
      },
      {
        protocol: "https",
        hostname: "*",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
