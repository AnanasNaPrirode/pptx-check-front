import type { NextConfig } from "next";

const staticExport = process.env.STATIC_EXPORT === "1";
const backendUrl = (
  process.env["BACKEND_URL"] ?? "https://pptx-check-back.relaxdev.ru"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Docker sets STATIC_EXPORT=1 and proxies /api in nginx.
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
