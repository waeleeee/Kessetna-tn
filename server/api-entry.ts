// @ts-nocheck
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "./routers";
import { createContext } from "./_core/context";
import { registerOAuthRoutes } from "./_core/oauth";
import { registerStorageProxy } from "./_core/storageProxy";

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// 1. HEALTH CHECK
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    db_configured: !!process.env.DATABASE_URL,
    auth_mode: process.env.USE_LOCAL_AUTH === "true" ? "local" : "oauth",
  });
});

// 2. OAuth routes
registerOAuthRoutes(app);

// 3. Storage proxy
registerStorageProxy(app);

// 4. tRPC
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
