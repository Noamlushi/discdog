import dotenv from "dotenv";

dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

// CLIENT_ORIGIN accepts a comma-separated list so the same server can serve the
// desktop (http://localhost:3000) and a phone on the LAN (http://<lan-ip>:3000)
// at the same time, without a deploy.
function originList(raw: string): string[] {
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  mongoUri: required("MONGODB_URI"),
  jwtSecret: required("JWT_SECRET"),
  clientOrigin: originList(process.env.CLIENT_ORIGIN ?? "http://localhost:3000"),
} as const;
