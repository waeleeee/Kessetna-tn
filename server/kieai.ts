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
 * Generate image using Kie.ai Nano Banana API (Ultimate Character Consistency Mode)
 */
export async function generateImageWithNanoBanana(
  prompt: string,
  childPhotoUrl?: string
): Promise<string> {
  const NANO_BANANA_API_KEY = "8fbad5fe9f8a9b1e4d08dfd2e97a2fad";
  const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";

  // ENHANCE PROMPT WITH HYPER-CONSISTENCY INSTRUCTIONS
  const enhancedPrompt = `
(USE_REFERENCE_IMAGE: ${childPhotoUrl})
The main character MUST BE AN EXACT CLONE of the child in this photo: ${childPhotoUrl}
REPLICATE FACE, HAIR, EYES, AND EXACT CLOTHING.
Style: Premium Anime / Studio Ghibli.
Setting: Sidi Bou Said, Tunisia.
Action: ${prompt}
  `.trim();

  console.log(`[AI] Nanobanana Request with URL: ${childPhotoUrl}`);

  const response = await fetch(`${NANO_BANANA_BASE}/api/v1/nanobanana/generate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NANO_BANANA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nano-banana",
      prompt: enhancedPrompt,
      // Try multiple possible field names for the reference image
      image: childPhotoUrl,
      ref_image: childPhotoUrl,
      image_url: childPhotoUrl,
      type: "TEXTTOIAMGE" // The magical typo version
    }),
  });

  const result = await response.json();
  console.log(`[AI] Nanobanana Response:`, JSON.stringify(result));
  
  const taskId = result.data?.taskId;
  if (!taskId) throw new Error(`NanoBanana Error: ${result.msg || "No taskId returned"}`);
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
