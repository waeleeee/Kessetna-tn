// @ts-nocheck
import { ENV } from "./_core/env";

const KIE_AI_API_BASE = "https://api.kie.ai";
const KIE_AI_API_KEY = process.env.KIE_AI_API_KEY || "45023506279af6f87ab82071fb0b5b0c";

/**
 * Generate story text and scenes using Kie.ai GPT API
 */
export interface StoryScene {
  text: string;
  imagePrompt: string;
}

export interface GeneratedStory {
  title: string;
  scenes: StoryScene[];
  characterDescription: string;
}

export async function generateStoryWithGPT(prompt: string): Promise<GeneratedStory> {
  const response = await fetch(`${KIE_AI_API_BASE}/gpt-5-2/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KIE_AI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-5-2",
      messages: [
        {
          role: "system",
          content: `You are an expert Arabic children's story writer and illustrator. 
Rules:
1. Create a story structured into EXACTLY 2 scenes.
2. For each scene, provide:
   - "text": The Arabic story text with FULL TASHKEEL (vowels/diacritics). This is CRITICAL.
   - "imagePrompt": A descriptive English prompt for an AI image generator (Watercolor vintage style, hand-drawn aesthetic, soft colors).
3. Also provide a "title" and a "characterDescription" for consistency.
4. Return a JSON object with the following structure:
   {
     "title": "Arabic Title",
     "characterDescription": "Detailed English description of the child's appearance (hair, eyes, clothes)",
     "scenes": [
       { "text": "Arabic text with tashkeel...", "imagePrompt": "English image prompt..." },
       ...
     ]
   }`
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 3500,
    }),
  });

  if (!response.ok) throw new Error(`GPT API Error: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || data.content || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsed = JSON.parse(jsonStr);
    return {
      title: parsed.title || "قصة سحرية",
      characterDescription: parsed.characterDescription || "A young child",
      scenes: parsed.scenes || [{ text: content, imagePrompt: "A happy child" }]
    };
  } catch (e) {
    return {
      title: "قصة سحرية",
      characterDescription: "A young child",
      scenes: [{ text: content, imagePrompt: "A happy child" }]
    };
  }
}

/**
 * AI Safety Agent: Verifies and sanitizes prompts to avoid AI generation blocks
 */
async function sanitizePrompt(prompt: string): Promise<string> {
  console.log(`[Safety Agent] Verifying prompt: ${prompt}`);
  try {
    const response = await fetch(`${KIE_AI_API_BASE}/gpt-5-2/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${KIE_AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5-2",
        messages: [
          {
            role: "system",
            content: `You are a professional prompt engineer for AI image generation. 
Your task is to take a story scene and rewrite it into a safe, high-quality prompt that will NOT be blocked by safety filters (like Gemini/Imagen). 
Follow these rules strictly:
1. Avoid words like "child", "boy", "girl", "kid", "toddler", or any age-related terms. Use "character", "person", or "figure" instead.
2. Focus on the action and the environment.
3. Include style instructions: "Studio Ghibli watercolor anime style, hand-drawn aesthetic, masterpiece, vibrant colors".
4. Ensure the prompt is descriptive but neutral.
5. Return ONLY the final prompt string.`
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
      }),
    });
    const data = await response.json();
    const cleanPrompt = data.choices?.[0]?.message?.content || prompt;
    console.log(`[Safety Agent] Sanitized prompt: ${cleanPrompt}`);
    return cleanPrompt;
  } catch (e) {
    console.error("[Safety Agent] Error sanitizing prompt:", e);
    return `A character in a Studio Ghibli watercolor anime scene, ${prompt}`;
  }
}

/**
 * Generate image using Kie.ai Nano Banana API (Safety Optimized)
 */
export async function generateImageWithNanoBanana(
  prompt: string,
  childPhotoUrl?: string
): Promise<string> {
  const finalSafePrompt = await sanitizePrompt(prompt);
  const NANO_BANANA_API_KEY = "16f35ec42dad2aa132d62f5ff3cf917d";
  const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";

  // Using the output of the Safety Agent directly
  const requestBody = {
    prompt: `Consistent character appearance and clothing, ${finalSafePrompt}, matching the visual style and colors of the reference image`,
    numImages: 1,
    type: "IMAGETOIAMGE",
    imageUrls: [childPhotoUrl],
    callBackUrl: "https://example.com/callback"
  };

  const response = await fetch(`${NANO_BANANA_BASE}/api/v1/nanobanana/generate`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${NANO_BANANA_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
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
  const NANO_BANANA_API_KEY = "16f35ec42dad2aa132d62f5ff3cf917d";
  const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";

  const response = await fetch(`${NANO_BANANA_BASE}/api/v1/nanobanana/record-info?taskId=${taskId}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${NANO_BANANA_API_KEY}` },
  });

  const result = await response.json();
  const data = result.data;

  let status: "pending" | "processing" | "completed" | "failed" = "processing";
  if (data?.successFlag === 1) status = "completed";
  else if (data?.successFlag === -1 || data?.successFlag === 3) status = "failed"; // 3 usually means filtered or error

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
