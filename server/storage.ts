// @ts-nocheck
import { ENV } from "./_core/env";

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "image/jpeg",
): Promise<{ key: string; url: string }> {
  // Vercel is read-only, so for quick testing we return a Data URL (Base64)
  // This bypasses the need for S3 or a local folder.
  
  const base64 = typeof data === "string" 
    ? data 
    : Buffer.from(data).toString("base64");
    
  const url = base64.startsWith("data:") 
    ? base64 
    : `data:${contentType};base64,${base64}`;
    
  return { 
    key: `test_${Date.now()}.jpg`, 
    url: url 
  };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  return { key: relKey, url: relKey };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  return relKey;
}
