// @ts-nocheck
import "dotenv/config";
import express from "express";
import path from "path";
import fs from "fs";

const app = express();

app.use(express.json());

// 1. HEALTH CHECK (Working!)
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    time: new Date().toISOString(), 
    cwd: process.cwd(),
    dirname: __dirname
  });
});

// 2. LAZY LOAD HEAVY ROUTERS
app.use("/api/trpc", async (req, res, next) => {
  try {
    const { createExpressMiddleware } = await import("@trpc/server/adapters/express");
    const { appRouter } = await import("../server/routers");
    const { createContext } = await import("../server/_core/context");
    return createExpressMiddleware({ router: appRouter, createContext })(req, res, next);
  } catch (e) {
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

// 3. STATIC FILES - Updated path logic
// On Vercel, the 'api' folder is often moved. We check both possibilities.
const possiblePaths = [
  path.join(process.cwd(), "dist", "public"),
  path.join(__dirname, "..", "dist", "public"),
  path.join(__dirname, "dist", "public")
];

let distPath = possiblePaths[0];
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    distPath = p;
    break;
  }
}

app.use(express.static(distPath));

app.get("*", (req, res) => {
  if (req.url.startsWith("/api")) return res.status(404).send("API not found");
  
  const indexPath = path.join(distPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    // If index.html is missing, let's at least show the path we tried
    res.status(503).send(`Frontend assets not found. Path: ${distPath}`);
  }
});

export default app;
