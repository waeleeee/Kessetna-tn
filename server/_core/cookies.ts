// @ts-nocheck
import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isProd = process.env.NODE_ENV === "production";
  
  return {
    httpOnly: true,
    path: "/",
    sameSite: isProd ? "lax" : "lax",
    secure: isProd, // Must be true on Vercel (HTTPS)
  };
}
