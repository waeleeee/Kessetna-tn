// @ts-nocheck
import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { registerStorageProxy } from "../server/_core/storageProxy";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

const app = express();

// Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Log basic info for debugging in Vercel Runtime Logs
console.log("Server starting... process.cwd():", process.cwd());

// Register routes
try {
  registerStorageProxy(app);
  registerOAuthRoutes(app);
} catch (e) {
  console.error("Failed to register routes:", e);
}

// tRPC
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Serve Static Files
// Vercel usually puts built assets in 'dist/public'
const distPath = path.resolve(process.cwd(), "dist", "public");
console.log("Checking distPath:", distPath);

if (fs.existsSync(distPath)) {
  console.log("distPath found! Serving static files.");
  app.use(express.static(distPath));
} else {
  console.warn("distPath NOT found at:", distPath);
}

// Fallback to index.html for SPA routing
app.use("*", (req, res) => {
  // If it's an API request that wasn't caught, return 404
  if (req.baseUrl.startsWith("/api")) {
    return res.status(404).json({ error: "API route not found" });
  }

  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send("Frontend assets are still building or missing. Please refresh in a moment.");
  }
});

export default app;
