// @ts-nocheck
import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  // We use a very simple config that works best for Vercel
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    // Vercel is always HTTPS in production
    secure: process.env.NODE_ENV === "production",
  };
}
