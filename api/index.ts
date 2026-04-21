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

// Register routes
registerStorageProxy(app);
registerOAuthRoutes(app);

// tRPC
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

// Serve Static Files from dist/public (where Vite builds to)
const distPath = path.join(process.cwd(), "dist", "public");

app.use(express.static(distPath));

// Fallback to index.html for SPA routing
app.use("*", (req, res) => {
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send("Frontend building... please refresh in a minute.");
  }
});

export default app;
