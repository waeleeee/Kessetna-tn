// server/api-entry.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "kessetna_session";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/routers.ts
import { z as z2 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";

// server/_core/cookies.ts
function getSessionCookieOptions(req) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    // Making it visible to JS briefly to verify presence on Vercel
    httpOnly: false,
    path: "/",
    sameSite: "lax",
    secure: isProd
  };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  kieAiApiKey: process.env.KIE_AI_API_KEY ?? "",
  useLocalAuth: process.env.USE_LOCAL_AUTH === "true"
};

// server/_core/notification.ts
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/kieai.ts
var KIE_AI_API_BASE = "https://api.kie.ai";
var KIE_AI_API_KEY = process.env.KIE_AI_API_KEY || "";
async function generateStoryWithGPT(prompt) {
  if (!KIE_AI_API_KEY) {
    throw new Error("KIE_AI_API_KEY environment variable is not set");
  }
  const response = await fetch(`${KIE_AI_API_BASE}/gpt-5-2/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KIE_AI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5-2",
      messages: [
        {
          role: "system",
          content: "You are a creative Arabic children's story writer. Write engaging, age-appropriate stories that teach valuable lessons."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2e3
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kie.ai GPT API error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  const storyText = data.choices?.[0]?.message?.content || data.content || data.text;
  if (!storyText) {
    throw new Error("No story text returned from Kie.ai API");
  }
  return storyText;
}
async function generateImageWithNanoBanana(prompt, childPhotoUrl) {
  const NANO_BANANA_API_KEY = "8fbad5fe9f8a9b1e4d08dfd2e97a2fad";
  const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";
  let imageData = childPhotoUrl;
  if (childPhotoUrl && !childPhotoUrl.startsWith("http") && !childPhotoUrl.startsWith("data:")) {
    try {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const absolutePath = path.join(process.cwd(), "client", "public", childPhotoUrl);
      if (fs.existsSync(absolutePath)) {
        const buffer = fs.readFileSync(absolutePath);
        imageData = `data:image/jpeg;base64,${buffer.toString("base64")}`;
      }
    } catch (e) {
      console.error("Failed to read local photo for AI:", e);
    }
  }
  const response = await fetch(`${NANO_BANANA_BASE}/api/v1/nanobanana/generate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NANO_BANANA_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "nano-banana",
      prompt,
      // Send the actual image data so the AI can see the child's clothes and face
      image: imageData,
      type: "TEXTTOIAMGE"
    })
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NanoBanana Image API error: ${response.status} - ${error}`);
  }
  const result = await response.json();
  const taskId = result.data?.taskId;
  if (!taskId) {
    throw new Error("No taskId returned from NanoBanana API");
  }
  return taskId;
}
async function getTaskStatus(taskId) {
  const NANO_BANANA_API_KEY = "8fbad5fe9f8a9b1e4d08dfd2e97a2fad";
  const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";
  const response = await fetch(`${NANO_BANANA_BASE}/api/v1/nanobanana/record-info?taskId=${taskId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${NANO_BANANA_API_KEY}`
    }
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NanoBanana Task Status API error: ${response.status} - ${error}`);
  }
  const result = await response.json();
  const data = result.data;
  let status = "processing";
  if (data.successFlag === 1) status = "completed";
  else if (data.successFlag === -1 || data.errorCode) status = "failed";
  else status = "processing";
  let imageUrl;
  if (data.response && data.response.resultImageUrl) {
    imageUrl = data.response.resultImageUrl;
  }
  return {
    status,
    result: imageUrl ? { images: [{ url: imageUrl }] } : void 0,
    error: data.errorMessage || void 0
  };
}
async function getImageUrlFromTask(taskId) {
  const status = await getTaskStatus(taskId);
  if (status.status === "completed" && status.result?.images?.[0]?.url) {
    return status.result.images[0].url;
  }
  if (status.status === "failed") {
    throw new Error(`Image generation failed: ${status.error || "Unknown error"}`);
  }
  return null;
}

// server/db.ts
import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

// drizzle/schema.ts
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
var users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: text("email", { length: 320 }),
  loginMethod: text("loginMethod", { length: 64 }),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull()
});
var stories = sqliteTable("stories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().references(() => users.id),
  childName: text("childName", { length: 255 }).notNull(),
  childAge: integer("childAge").notNull(),
  educationalGoal: text("educationalGoal", { length: 255 }).notNull(),
  problemDescription: text("problemDescription").notNull(),
  childPhotoUrl: text("childPhotoUrl"),
  storyText: text("storyText"),
  status: text("status", { enum: ["pending", "generating", "completed", "failed"] }).default("pending").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull()
});
var generatedImages = sqliteTable("generatedImages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  storyId: integer("storyId").notNull().references(() => stories.id),
  paragraphIndex: integer("paragraphIndex").notNull(),
  prompt: text("prompt").notNull(),
  taskId: text("taskId", { length: 255 }).notNull(),
  imageUrl: text("imageUrl"),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull()
});

// server/db.ts
var _db = null;
var _sqliteInstance = null;
async function getDb() {
  if (!_db) {
    try {
      let url = (ENV.databaseUrl || "file:sqlite.db").replace("libsql://", "https://");
      if (url && !url.startsWith("https://") && !url.startsWith("wss://") && !url.startsWith("file:")) {
        url = `file:${url}`;
      }
      const authToken = process.env.DATABASE_AUTH_TOKEN;
      console.log(`[Database] Connecting to: ${url.startsWith("file:") ? "Local SQLite" : "Remote LibSQL"}`);
      _sqliteInstance = createClient({
        url,
        authToken
      });
      _db = drizzle(_sqliteInstance);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  try {
    const values = {
      openId: user.openId
    };
    const updateSet = {};
    const textFields = ["name", "email", "loginMethod"];
    const assignNullable = (field) => {
      const value = user[field];
      if (value === void 0) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== void 0) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== void 0) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) {
      values.lastSignedIn = /* @__PURE__ */ new Date();
    }
    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = /* @__PURE__ */ new Date();
    }
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : void 0;
}
async function createStory(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(stories).values(data).returning();
  return result;
}
async function getStoryById(storyId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  return result.length > 0 ? result[0] : null;
}
async function updateStory(storyId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(stories).set(data).where(eq(stories.id, storyId));
}
async function createGeneratedImage(data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(generatedImages).values(data).returning();
  return result;
}
async function getImagesByStoryId(storyId) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(generatedImages).where(eq(generatedImages.storyId, storyId));
  return result;
}
async function updateGeneratedImage(imageId, data) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(generatedImages).set(data).where(eq(generatedImages.id, imageId));
}

// server/storage.ts
function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  if (!forgeUrl || !forgeKey) {
    if (ENV.useLocalAuth) {
      return { forgeUrl: "local", forgeKey: "local" };
    }
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY"
    );
  }
  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}
function normalizeKey(relKey) {
  return relKey.replace(/^\/+/, "");
}
function appendHashSuffix(relKey) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}
async function storagePut(relKey, data, contentType = "application/octet-stream") {
  const { forgeUrl, forgeKey } = getForgeConfig();
  const key = appendHashSuffix(normalizeKey(relKey));
  if (forgeUrl === "local") {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const uploadDir = path.join(process.cwd(), "client", "public", "uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, key);
    const fileDir = path.dirname(filePath);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }
    fs.writeFileSync(filePath, data);
    return { key, url: `/uploads/${key}` };
  }
  const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, {
    headers: { Authorization: `Bearer ${forgeKey}` }
  });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = await presignResp.json();
  if (!s3Url) throw new Error("Forge returned empty presign URL");
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data], { type: contentType });
  const uploadResp = await fetch(s3Url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob
  });
  if (!uploadResp.ok) {
    throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  }
  return { key, url: `/manus-storage/${key}` };
}

// server/routers.ts
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true
      };
    })
  }),
  story: router({
    /**
     * Create a new story with optional image generation
     */
    create: protectedProcedure.input(
      z2.object({
        childName: z2.string().min(1),
        childAge: z2.number().min(3).max(12),
        educationalGoal: z2.string().min(1),
        problemDescription: z2.string().min(1),
        childPhotoBase64: z2.string().optional()
      })
    ).mutation(async ({ ctx, input }) => {
      try {
        let childPhotoUrl;
        if (input.childPhotoBase64) {
          try {
            const buffer = Buffer.from(input.childPhotoBase64, "base64");
            const { url } = await storagePut(
              `child-photos/${ctx.user.id}-${Date.now()}.jpg`,
              buffer,
              "image/jpeg"
            );
            childPhotoUrl = url;
          } catch (error) {
            console.error("Photo upload failed:", error);
            throw new TRPCError3({
              code: "INTERNAL_SERVER_ERROR",
              message: "\u0641\u0634\u0644 \u062A\u062D\u0645\u064A\u0644 \u0635\u0648\u0631\u0629 \u0627\u0644\u0637\u0641\u0644. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
            });
          }
        }
        let storyId;
        try {
          const storyResult = await createStory({
            userId: ctx.user.id,
            childName: input.childName,
            childAge: input.childAge,
            educationalGoal: input.educationalGoal,
            problemDescription: input.problemDescription,
            childPhotoUrl,
            status: "generating"
          });
          if (!storyResult || storyResult.length === 0 || typeof storyResult[0].id !== "number") {
            throw new Error("Failed to get story ID from database");
          }
          storyId = storyResult[0].id;
        } catch (error) {
          console.error("Story creation failed:", error);
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0642\u0635\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
          });
        }
        let storyText;
        try {
          const prompt = `
\u0623\u0646\u062A \u0643\u0627\u062A\u0628 \u0642\u0635\u0635 \u0623\u0637\u0641\u0627\u0644 \u0645\u062D\u062A\u0631\u0641. \u0627\u0643\u062A\u0628 \u0642\u0635\u0629 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u062D\u0649 \u0644\u0644\u0637\u0641\u0644 ${input.childName} (${input.childAge} \u0633\u0646\u0629).
\u0627\u0644\u0645\u0634\u0643\u0644\u0629: ${input.problemDescription}.
\u0627\u0644\u0647\u062F\u0641 \u0627\u0644\u062A\u0631\u0628\u0648\u064A: ${input.educationalGoal}.

\u0627\u0644\u0645\u062A\u0637\u0644\u0628\u0627\u062A:
1. \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u0627\u0644\u0642\u0635\u0629 \u0628\u0627\u0644\u0644\u063A\u0629 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0627\u0644\u0641\u0635\u062D\u0649 \u0627\u0644\u0633\u0644\u064A\u0645\u0629.
2. \u064A\u062C\u0628 \u0623\u0646 \u062A\u0643\u0648\u0646 \u062C\u0645\u064A\u0639 \u0627\u0644\u0643\u0644\u0645\u0627\u062A \u0645\u0634\u0643\u0648\u0644\u0629 \u0634\u0643\u0644\u0627\u064B \u062A\u0627\u0645\u0627\u064B (Tashkeel) \u0644\u0645\u0633\u0627\u0639\u062F\u0629 \u0627\u0644\u0637\u0641\u0644 \u0639\u0644\u0649 \u0627\u0644\u0642\u0631\u0627\u0621\u0629.
3. \u0627\u0628\u062F\u0623 \u0628\u0627\u0644\u0642\u0635\u0629 \u0645\u0628\u0627\u0634\u0631\u0629 \u062F\u0648\u0646 \u0623\u064A \u0645\u0642\u062F\u0645\u0627\u062A.
4. \u0642\u0633\u0645 \u0627\u0644\u0642\u0635\u0629 \u0625\u0644\u0649 \u0641\u0642\u0631\u062A\u064A\u0646 \u0645\u0634\u0648\u0642\u062A\u064A\u0646.
            `.trim();
          storyText = await generateStoryWithGPT(prompt);
        } catch (error) {
          console.error("Story generation failed:", error);
          await updateStory(storyId, { status: "failed" });
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0642\u0635\u0629. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
          });
        }
        try {
          await updateStory(storyId, {
            storyText,
            status: "completed"
          });
        } catch (error) {
          console.error("Story update failed:", error);
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u0642\u0635\u0629."
          });
        }
        if (childPhotoUrl) {
          const paragraphs = storyText.split("\n").filter((p) => p.trim().length > 0).slice(0, 2);
          for (let i = 0; i < paragraphs.length; i++) {
            const paragraph = paragraphs[i];
            const imagePrompt = `
CRITICAL: HIGH CHARACTER CONSISTENCY REQUIRED.
The main character MUST BE AN EXACT MATCH to the child in the reference photo. 
REPLICATE THEIR FACE, HAIR, AND EXACT CLOTHING from the photo.
Scene to illustrate: "${paragraph}".
Setting: Traditional Tunisian background (Sidi Bou Said style white walls and blue doors).
Style: Premium Anime/Ghibli illustration, high detail, vibrant, safe for kids.
              `.trim();
            try {
              const taskId = await generateImageWithNanoBanana(imagePrompt, childPhotoUrl);
              await createGeneratedImage({
                storyId,
                paragraphIndex: i,
                prompt: imagePrompt,
                taskId,
                status: "processing"
              });
            } catch (error) {
              console.error(`Failed to generate image for paragraph ${i}:`, error);
            }
          }
        }
        return {
          storyId,
          storyText,
          hasImages: !!childPhotoUrl
        };
      } catch (error) {
        if (error instanceof TRPCError3) {
          throw error;
        }
        console.error("Story creation error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639. \u064A\u0631\u062C\u0649 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u0631\u0629 \u0623\u062E\u0631\u0649."
        });
      }
    }),
    /**
     * Get story status and poll for image generation
     */
    getStatus: protectedProcedure.input(z2.object({ storyId: z2.number() })).query(async ({ ctx, input }) => {
      try {
        const story = await getStoryById(input.storyId);
        if (!story) {
          throw new TRPCError3({
            code: "NOT_FOUND",
            message: "\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0642\u0635\u0629"
          });
        }
        if (story.userId !== ctx.user.id) {
          throw new TRPCError3({
            code: "FORBIDDEN",
            message: "\u0644\u064A\u0633 \u0644\u062F\u064A\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0644\u0644\u0648\u0635\u0648\u0644 \u0625\u0644\u0649 \u0647\u0630\u0647 \u0627\u0644\u0642\u0635\u0629"
          });
        }
        const images = await getImagesByStoryId(input.storyId);
        if (story.status === "generating" || story.status === "completed") {
          for (const image of images) {
            if (image.status === "processing") {
              try {
                const remoteUrl = await getImageUrlFromTask(image.taskId);
                if (remoteUrl) {
                  try {
                    const imgResp = await fetch(remoteUrl);
                    const buffer = await imgResp.arrayBuffer();
                    const { url: localUrl } = await storagePut(
                      `generated-images/${story.id}-${image.paragraphIndex}.jpg`,
                      Buffer.from(buffer),
                      "image/jpeg"
                    );
                    await updateGeneratedImage(image.id, {
                      imageUrl: localUrl,
                      status: "completed"
                    });
                  } catch (downloadError) {
                    console.error(`Failed to download and save image:`, downloadError);
                    await updateGeneratedImage(image.id, {
                      imageUrl: remoteUrl,
                      status: "completed"
                    });
                  }
                }
              } catch (error) {
                console.error(`Failed to get image status for task ${image.taskId}:`, error);
                await updateGeneratedImage(image.id, {
                  status: "failed"
                });
              }
            }
          }
        }
        const updatedImages = await getImagesByStoryId(input.storyId);
        return {
          story,
          images: updatedImages
        };
      } catch (error) {
        if (error instanceof TRPCError3) {
          throw error;
        }
        console.error("Get story status error:", error);
        throw new TRPCError3({
          code: "INTERNAL_SERVER_ERROR",
          message: "\u0641\u0634\u0644 \u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u062D\u0627\u0644\u0629 \u0627\u0644\u0642\u0635\u0629"
        });
      }
    })
  })
});

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString2 = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString2(openId) || !isNonEmptyString2(appId) || !isNonEmptyString2(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    console.log(`[Auth] authenticateRequest: Cookie name: ${COOKIE_NAME}, Found: ${!!sessionCookie}`);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      if (ENV.useLocalAuth) {
        throw ForbiddenError("User not found in local database");
      }
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/?login_success=true");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
  app2.get("/api/auth/local", async (req, res) => {
    try {
      const mockOpenId = "local-user";
      try {
        await upsertUser({
          openId: mockOpenId,
          name: "Local Developer",
          email: "local@example.com",
          loginMethod: "local",
          lastSignedIn: /* @__PURE__ */ new Date()
        });
      } catch (dbErr) {
        console.warn("[Auth] DB upsert skipped (DB may not be initialized yet):", dbErr.message);
      }
      const sessionToken = await sdk.createSessionToken(mockOpenId, {
        name: "Local Developer",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      console.log(`[Auth] Setting cookie ${COOKIE_NAME} on Vercel:`, JSON.stringify(cookieOptions));
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/?login_success=true");
    } catch (error) {
      console.error("[Auth] Local login failed", error);
      res.status(500).json({ error: "Local login failed", detail: error.message });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      if (ENV.useLocalAuth) {
        res.redirect(307, `/uploads/${key}`);
        return;
      }
      res.status(500).send("Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/api-entry.ts
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    db_configured: !!process.env.DATABASE_URL,
    auth_mode: process.env.USE_LOCAL_AUTH === "true" ? "local" : "oauth"
  });
});
registerOAuthRoutes(app);
registerStorageProxy(app);
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext
  })
);
var api_entry_default = app;
export {
  api_entry_default as default
};
