import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  turbopack: {
    root: path.resolve(import.meta.dirname || ""),
  },
};

export default nextConfig;
