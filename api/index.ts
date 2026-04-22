// @ts-nocheck
import "dotenv/config";
import express from "express";

const app = express();
app.use(express.json());

// 1. HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    db_configured: !!process.env.DATABASE_URL,
    auth_mode: process.env.USE_LOCAL_AUTH === "true" ? "local" : "oauth"
  });
});

// 2. LAZY LOAD HEAVY ROUTERS
app.use("/api/trpc", async (req, res, next) => {
  try {
    console.log("tRPC Request:", req.url);
    const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
    const { appRouter } = await import("../server/routers");
    const { createContext } = await import("../server/_core/context");
    
    const handler = createExpressMiddleware({
      router: appRouter,
      createContext,
    });
    return handler(req, res, next);
  } catch (e) {
    console.error("CRITICAL TRPC STARTUP ERROR:", e);
    res.status(500).json({ 
      error: "API Engine Failed", 
      message: e.message,
      stack: process.env.NODE_ENV === "development" ? e.stack : undefined 
    });
  }
});

app.use("/api/auth", async (req, res, next) => {
  try {
    const { registerOAuthRoutes } = await import("../server/_core/oauth");
    const authApp = express();
    registerOAuthRoutes(authApp);
    return authApp(req, res, next);
  } catch (e) {
    console.error("AUTH STARTUP ERROR:", e);
    res.status(500).json({ error: "Auth Engine Failed", message: e.message });
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

export default app;
