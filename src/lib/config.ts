export const APP_NAME = "dayibiza.link";

export const CNAME_TARGET =
  process.env.SHORTLINK_CNAME_TARGET ||
  process.env.NEXT_PUBLIC_SHORTLINK_CNAME_TARGET ||
  "links.example.com";

export const DEFAULT_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
