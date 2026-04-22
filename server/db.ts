import { eq } from "drizzle-orm";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { InsertUser, users, stories, generatedImages, InsertStory, InsertGeneratedImage } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;
let _sqliteInstance: any = null;

export async function getDb() {
  if (!_db) {
    try {
      let url = (ENV.databaseUrl || "file:sqlite.db").replace("libsql://", "https://");
      // Ensure local files have the file: prefix
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

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized as any;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createStory(data: InsertStory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(stories).values(data).returning();
  return result;
}

export async function getStoryById(storyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(stories).where(eq(stories.id, storyId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateStory(storyId: number, data: Partial<InsertStory>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(stories).set(data).where(eq(stories.id, storyId));
}

export async function createGeneratedImage(data: InsertGeneratedImage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(generatedImages).values(data).returning();
  return result;
}

export async function getImagesByStoryId(storyId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.select().from(generatedImages).where(eq(generatedImages.storyId, storyId));
  return result;
}

export async function updateGeneratedImage(imageId: number, data: Partial<InsertGeneratedImage>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(generatedImages).set(data).where(eq(generatedImages.id, imageId));
}
