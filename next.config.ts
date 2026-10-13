import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";
const backendUrl = (process.env["BACKEND_URL"] ?? "http://127.0.0.1:8000").replace(
  /\/$/,
  "",
);

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // Static export cannot be combined with rewrites, including in `next dev`.
  // Export is production-only; the dev server proxies /api to the backend.
  ...(isDev
    ? {
        async rewrites() {
          return [
            {
              source: "/api/:path*",
              destination: `${backendUrl}/api/:path*`,
            },
          ];
        },
      }
    : { output: "export" as const }),
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
