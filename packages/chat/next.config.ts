import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Pages adapter
  // Install @opennextjs/cloudflare for deployment
  // npx @opennextjs/cloudflare init
  
  // PWA manifest
  async headers() {
    return [
      {
        source: "/manifest.json",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
    ];
  },
  
  // Allow Cloudflare Workers backend
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8787"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;