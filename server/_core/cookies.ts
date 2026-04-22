// @ts-nocheck
import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(
  req: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const isProd = process.env.NODE_ENV === "production";
  
  return {
    // Making it visible to JS briefly to verify presence on Vercel
    httpOnly: false, 
    path: "/",
    sameSite: "lax",
    secure: isProd,
  };
}
