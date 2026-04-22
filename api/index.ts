// @ts-nocheck
import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";

const app = express();

app.use(express.json());

// 1. HEALTH CHECK (No dependencies)
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString(), env: process.env.NODE_ENV });
});

// 2. LAZY LOAD HEAVY ROUTERS
// We only import these when they are actually called to prevent startup crashes
app.use("/api/trpc", async (req, res, next) => {
  try {
    const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
    const { appRouter } = await import("../server/routers");
    const { createContext } = await import("../server/_core/context");
    
    return createExpressMiddleware({
      router: appRouter,
      createContext,
    })(req, res, next);
  } catch (e) {
    console.error("tRPC initialization error:", e);
    res.status(500).json({ error: "tRPC failed to load", details: e.message });
  }
});

app.use("/api/auth", async (req, res, next) => {
  try {
    const { registerOAuthRoutes } = await import("../server/_core/oauth");
    const authApp = express();
    registerOAuthRoutes(authApp);
    return authApp(req, res, next);
  } catch (e) {
    res.status(500).json({ error: "Auth failed to load" });
  }
});

// 3. STATIC FILES
const distPath = path.resolve(process.cwd(), "dist", "public");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  if (req.url.startsWith("/api")) return res.status(404).send("API not found");
  
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send("Building frontend... please refresh.");
  }
});

export default app;
