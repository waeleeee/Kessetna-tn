// @ts-nocheck
import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";

const app = express();

app.use(express.json());

// 1. HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 2. LAZY LOAD HEAVY ROUTERS
app.use("/api/trpc", async (req, res, next) => {
  try {
    const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
    const { appRouter } = await import("../server/routers");
    const { createContext } = await import("../server/_core/context");
    return createExpressMiddleware({ router: appRouter, createContext })(req, res, next);
  } catch (e) {
    res.status(500).json({ error: "tRPC error", details: e.message });
  }
});

app.use("/api/auth", async (req, res, next) => {
  try {
    const { registerOAuthRoutes } = await import("../server/_core/oauth");
    const authApp = express();
    registerOAuthRoutes(authApp);
    return authApp(req, res, next);
  } catch (e) {
    res.status(500).json({ error: "Auth error" });
  }
});

// 3. STORAGE PROXY
app.use("/manus-storage", async (req, res, next) => {
  try {
    const { registerStorageProxy } = await import("../server/_core/storageProxy");
    const storageApp = express();
    registerStorageProxy(storageApp);
    return storageApp(req, res, next);
  } catch (e) {
    res.status(500).send("Storage error");
  }
});

// For any other request, return index.html (SPA fallback)
// This is handled by Vercel rewrites, but we add it here just in case.
app.get("*", (req, res) => {
  if (req.url.startsWith("/api")) return res.status(404).send("API not found");
  
  // Just send a 404 for anything else caught by the bridge
  res.status(404).send("Not found");
});

export default app;
