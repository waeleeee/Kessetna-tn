// @ts-nocheck
import { imageMemoryStore } from "./imageStore";

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "image/jpeg",
): Promise<{ key: string; url: string }> {
  // Generate a short ID for memory store
  const id = Math.random().toString(36).substring(7) + ".jpg";
  
  const buffer = typeof data === "string" 
    ? Buffer.from(data, "base64") 
    : Buffer.from(data);
    
  imageMemoryStore.set(id, buffer);
  
  // Return the relative URL. The router will convert this to an absolute one for the AI.
  return { 
    key: id, 
    url: `/api/img-serve/${id}` 
  };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  return { key: relKey, url: `/api/img-serve/${relKey}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  return `/api/img-serve/${relKey}`;
}
