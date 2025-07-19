/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  images: {
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
    nodeMiddleware: true,
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
