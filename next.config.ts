import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // StrictMode double-mounts the WebGL context in dev, which forces a context loss.
  reactStrictMode: false,
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
