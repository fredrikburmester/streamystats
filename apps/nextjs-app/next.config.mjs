/** @type {import('next').NextConfig} */
const { version } = require("./../../package.json");

const nextConfig = {
  output: "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  cacheComponents: true,
  images: {
    dangerouslyAllowLocalIP: true,
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
  env: {
    version,
  },
};

export default nextConfig;
