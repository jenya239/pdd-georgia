import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["@prisma/adapter-pg", "@prisma/client", "pg"],
  turbopack: {
    root: path.resolve(appDir, "../.."),
  },
};

export default nextConfig;
