import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This single line hides the indicator
  devIndicators: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "www.appsheet.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/api/public/extension-sync",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, x-extension-key" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Flutter web SPA — serve index.html for all /app/* deep-link routes.
      // The regex negative lookahead skips paths containing a dot (file extensions)
      // so static assets (.js, .css, .png etc.) are served normally.
      { source: "/app", destination: "/app/index.html" },
      { source: "/app/:path((?!.*\\.).*)", destination: "/app/index.html" },
    ];
  },
};

export default nextConfig;
