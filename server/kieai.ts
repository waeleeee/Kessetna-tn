// @ts-nocheck
import { ENV } from "./_core/env";

const KIE_AI_API_BASE = "https://api.kie.ai";
const KIE_AI_API_KEY = process.env.KIE_AI_API_KEY || "45023506279af6f87ab82071fb0b5b0c";

/**
 * Generate story text using Kie.ai GPT API
 */
export async function generateStoryWithGPT(prompt: string): Promise<string> {
  const response = await fetch(`${KIE_AI_API_BASE}/gpt-5-2/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KIE_AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-2",
      messages: [{ role: "system", content: "You are a creative Arabic children's story writer." }, { role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) throw new Error(`GPT API Error: ${response.status}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content || data.content || "";
}

/**
 * Generate image using Kie.ai Nano Banana API
 */
export async function generateImageWithNanoBanana(
  prompt: string,
  childPhotoUrl?: string
): Promise<string> {
  const NANO_BANANA_API_KEY = "8fbad5fe9f8a9b1e4d08dfd2e97a2fad";
  const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";

  // Clean the image data - remove prefix if it's a data URL
  let imageBase64 = childPhotoUrl;
  if (childPhotoUrl && childPhotoUrl.startsWith("data:")) {
    imageBase64 = childPhotoUrl.split(",")[1];
  }

  console.log(`[AI] Requesting Nanobanana image for prompt: ${prompt.slice(0, 50)}...`);

  const response = await fetch(`${NANO_BANANA_BASE}/api/v1/nanobanana/generate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NANO_BANANA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nano-banana",
      prompt,
      image: imageBase64, // Sending raw base64
      type: "TEXTTOIMAGE" // Fixed typo from TEXTTOIAMGE
    }),
  });

  const result = await response.json();
  console.log(`[AI] Nanobanana Response:`, JSON.stringify(result));
  
  const taskId = result.data?.taskId;
  if (!taskId) throw new Error("No taskId returned from NanoBanana");
  return taskId;
}

/**
 * Poll task status
 */
export async function getTaskStatus(taskId: string): Promise<any> {
  const NANO_BANANA_API_KEY = "8fbad5fe9f8a9b1e4d08dfd2e97a2fad";
  const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";

  const response = await fetch(`${NANO_BANANA_BASE}/api/v1/nanobanana/record-info?taskId=${taskId}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${NANO_BANANA_API_KEY}` },
  });

  const result = await response.json();
  const data = result.data;

  let status: "pending" | "processing" | "completed" | "failed" = "processing";
  if (data?.successFlag === 1) status = "completed";
  else if (data?.successFlag === -1) status = "failed";

  return {
    status,
    result: data?.response?.resultImageUrl ? { images: [{ url: data.response.resultImageUrl }] } : undefined,
    error: data?.errorMessage,
  };
}

export async function getImageUrlFromTask(taskId: string): Promise<string | null> {
  const status = await getTaskStatus(taskId);
  if (status.status === "completed" && status.result?.images?.[0]?.url) {
    return status.result.images[0].url;
  }
  return null;
}
