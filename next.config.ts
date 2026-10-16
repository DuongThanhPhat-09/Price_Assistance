import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets a second build/dev server (tests, CI) use its own output folder
  // without clobbering the one `npm run dev` is using.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Camera + microphone are needed on our own origin only.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self)" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
