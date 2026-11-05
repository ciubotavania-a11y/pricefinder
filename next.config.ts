import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "*.app.github.dev",
        "localhost:3000",
        "localhost:3001",
        "localhost:3002",
        "localhost:3003"
      ],
    },
  },
};

export default nextConfig;
