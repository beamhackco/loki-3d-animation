import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Everything runs in the browser, so the build is plain files in ./out for Cloudflare Pages.
  output: "export",
  // StrictMode double-mounts the WebGL context in dev, which forces a context loss.
  reactStrictMode: false,
  poweredByHeader: false,
  devIndicators: false,
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
