import { existsSync } from "node:fs";
import type { NextConfig } from "next";

// Docker build runs scripts/bake-rewrites.mjs first, which writes this file.
// RelaxDev replaces unknown env vars with stubs, so the flag cannot be an env var.
const staticExport = existsSync("nginx.conf.generated.template");
const backendUrl = (
  process.env["BACKEND_URL"] ?? "https://pptx-check-back.relaxdev.ru"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Docker builds a static export and proxies /api in nginx.
  // The Next.js server (local dev and RelaxDev autodetect) proxies /api itself.
  ...(staticExport
    ? { output: "export" as const }
    : {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${backendUrl}/api/:path*`,
            },
          ];
        },
      }),
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
