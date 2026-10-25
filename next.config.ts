import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The child's prescription upload. Next.js allows 1 MB by default; Vercel takes at most 4.5 MB.
  // Photos are shrunk in the browser first, so this is mostly room for PDFs.
  experimental: { serverActions: { bodySizeLimit: "4.4mb" } },
  // ffmpeg finds its binary next to itself, so it must stay outside the bundle,
  // and the Linux binary must ship with every function that sends voice notes.
  serverExternalPackages: ["@ffmpeg-installer/ffmpeg"],
  outputFileTracingIncludes: {
    "/api/whatsapp": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
    "/api/cron/tick": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
    "/check": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
    "/home": ["./node_modules/@ffmpeg-installer/linux-x64/**"],
  },
  partialPrefetching: true,
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
