import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

// §6.1 PWA — Serwist compiles app/sw.ts into public/sw.js and auto-registers it.
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development", // skip SW caching in dev
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default withSerwist(nextConfig);
