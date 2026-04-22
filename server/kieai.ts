// @ts-nocheck
import { ENV } from "./_core/env";

const KIE_AI_API_BASE = "https://api.kie.ai";
const KIE_AI_API_KEY = process.env.KIE_AI_API_KEY || "45023506279af6f87ab82071fb0b5b0c";

/**
 * Generate story text using Kie.ai GPT API
 */
export async function generateStoryWithGPT(prompt: string): Promise<{ story: string; visualPrompt: string }> {
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
          content: `You are an expert Arabic children's story writer. 
Rules:
1. Write ONLY the story content. 
2. Use FULL TASHKEEL (vowels/diacritics) for every word. This is CRITICAL.
3. NO introductory remarks (e.g., "Certainly!", "Here is...").
4. NO concluding remarks or questions (e.g., "Would you like...", "I hope...").
5. Return a JSON object with two fields: 
   - "story": The Arabic story text with full tashkeel.
   - "visualPrompt": A short, descriptive English prompt (max 50 words) for an AI image generator describing the scene. Focus on the main character and the Tunisian setting. Keep it safe and educational.`
        }, 
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2500,
    }),
  });

  if (!response.ok) throw new Error(`GPT API Error: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || data.content || "";
  
  try {
    // Extract JSON if it's wrapped in markdown blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsed = JSON.parse(jsonStr);
    return {
      story: parsed.story || content,
      visualPrompt: parsed.visualPrompt || "A happy child in Sidi Bou Said, Tunisia, vibrant colors."
    };
  } catch (e) {
    return { 
      story: content, 
      visualPrompt: "A happy child in Sidi Bou Said, Tunisia, vibrant colors." 
    };
  }
}

/**
 * Generate image using Kie.ai Nano Banana API (Safety Optimized)
 */
export async function generateImageWithNanoBanana(
  prompt: string,
  childPhotoUrl?: string
): Promise<string> {
  const NANO_BANANA_API_KEY = "b7aa7cee46af40269c2d8a7d036cbfb0";
  const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";

  // FLUID & HEALTHY PROMPT FOR TUNISIAN STYLE (Text + Image Reference)
  const safePrompt = `
Educational children's book illustration, vibrant Ghibli-inspired anime art.
Character: The child from the attached reference photo. MUST MATCH FACE AND CLOTHING EXACTLY.
Action: ${prompt}
Setting: Sidi Bou Said, Tunisia, white walls, blue windows, mediterranean atmosphere.
Style: Professional illustration, clean lines, bright colors, friendly and safe for children.
  `.trim();

  console.log(`[AI] Nanobanana Safe Request with originImageUrl: ${childPhotoUrl}`);

  const requestBody = {
    model: "nano-banana",
    prompt: safePrompt,
    originImageUrl: childPhotoUrl,
    type: "TEXTTOIAMGE",
    numImages: 1,
    watermarkFlag: true
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
  const NANO_BANANA_API_KEY = "b7aa7cee46af40269c2d8a7d036cbfb0";
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
