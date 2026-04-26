// @ts-nocheck
import { ENV } from "./_core/env";

const KIE_AI_API_BASE = "https://api.kie.ai";
const KIE_AI_API_KEY = process.env.KIE_AI_API_KEY || "45023506279af6f87ab82071fb0b5b0c";
const NANO_BANANA_API_KEY = process.env.NANO_BANANA_API_KEY || "6f864e5aad70bcf038d76f8c6c8c4afe";
const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";

// Timeout wrapper for fetch with exponential backoff retry
const fetchWithTimeout = async (
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 30000,
  maxRetries: number = 3
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      lastError = error;
      const isTimeoutError = error.name === "AbortError" || error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED";
      const isNetworkError = error instanceof TypeError && error.message.includes("fetch failed");

      if ((isTimeoutError || isNetworkError) && attempt < maxRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s
        console.warn(
          `[fetchWithTimeout] Attempt ${attempt + 1} failed (${error.message}). ` +
          `Retrying in ${delayMs}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error("Failed after max retries");
};

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

export async function generateStoryWithGPT(prompt: string, characterGender: string = "neutral"): Promise<GeneratedStory> {
  const genderInstruction = characterGender === "male" 
    ? "استخدم ضمائر مذكرة (هو، ولده، ابنه) وأسماء ذكورية"
    : characterGender === "female"
    ? "استخدم ضمائر مؤنثة (هي، ابنته، أختها) وأسماء نسائية"
    : "استخدم الاسم المعطى بدون تحديد جنس";

  const response = await fetchWithTimeout(
    `${KIE_AI_API_BASE}/gpt-5-2/v1/chat/completions`,
    {
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
2. ${genderInstruction}
3. For each scene, provide:
   - "text": The Arabic story text with FULL TASHKEEL (vowels/diacritics). This is CRITICAL. Keep character consistent throughout.
   - "imagePrompt": A descriptive English prompt for an AI image generator (Watercolor vintage style, hand-drawn aesthetic, soft colors).
4. Also provide a "title" and a "characterDescription" for consistency.
5. The character should appear in BOTH scenes with consistent appearance.
6. Return a JSON object with the following structure:
   {
     "title": "Arabic Title",
     "characterDescription": "Detailed English description of the child's appearance (hair, eyes, clothes)",
     "scenes": [
       { "text": "Arabic text with tashkeel...", "imagePrompt": "English image prompt..." },
       { "text": "Arabic text with tashkeel...", "imagePrompt": "English image prompt..." }
     ]
   }`
          },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 3500,
      }),
    },
    45000,
    3
  );

  if (!response.ok) throw new Error(`GPT API Error: ${response.status}`);
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || data.content || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;
    const parsed = JSON.parse(jsonStr);
    
    // Validate we have exactly 2 scenes
    if (!parsed.scenes || parsed.scenes.length < 2) {
      throw new Error("Story must have exactly 2 scenes");
    }
    
    return {
      title: parsed.title || "قصة سحرية",
      characterDescription: parsed.characterDescription || "A young child",
      scenes: parsed.scenes.slice(0, 2) // Ensure exactly 2 scenes
    };
  } catch (e) {
    console.error("Story parsing error:", e, "Content:", content);
    return {
      title: "قصة سحرية",
      characterDescription: "A young child",
      scenes: [
        { text: content, imagePrompt: "A happy child" },
        { text: "وعاشوا في سعادة أبدية.", imagePrompt: "A happy child in celebration" }
      ]
    };
  }
}

async function sanitizePrompt(prompt: string, characterName: string = "the subject", attempt: number = 1): Promise<string> {
  console.log(`[Safety Agent] Verifying prompt (Attempt ${attempt}): ${prompt.substring(0, 80)}...`);
  
  try {
    const systemPrompt = attempt === 1 
      ? `You are a prompt engineer that rewrites prompts to be safe for image generation while preserving artistic intent.
      
CRITICAL RULES:
1. NEVER describe age, appearance, body, or physical features of people
2. FOCUS ON: scene setting, environment, background, objects, emotions, actions
3. Use generic terms: "a person", "figure", "character" (NO child/boy/girl/kid/baby/young/toddler)
4. NO descriptions of: clothing details, hair, eyes, face, body shape, size
5. ADD context: "in a Tunisian medina", "traditional setting", "storybook scene"
6. Keep prompt SHORT and SIMPLE (under 50 words ideally)
7. Return ONLY the rewritten prompt, nothing else`
      : `Rewrite this image prompt to be EXTREMELY simple and safe. Remove all person descriptions. Focus ONLY on the scene/environment.
KEY: A figure standing in a beautiful Tunisian scene. That's it. Just the setting.
Return ONLY the rewritten prompt.`;

    const response = await fetchWithTimeout(
      `${KIE_AI_API_BASE}/gpt-5-2/v1/chat/completions`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${KIE_AI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5-2",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          temperature: 0.1,
        }),
      },
      30000,
      1
    );
    
    const data = await response.json();
    let cleanPrompt = data.choices?.[0]?.message?.content || prompt;
    
    // Aggressive safety cleanup
    const unsafeWords = /\b(boy|girl|child|kid|toddler|baby|son|daughter|young|infant|age|years old|cute|sexy|sexual|nude|naked|underage|minor|teen|adolescent|juvenile)\b/gi;
    cleanPrompt = cleanPrompt.replace(unsafeWords, "");
    
    // Remove consecutive spaces
    cleanPrompt = cleanPrompt.replace(/\s+/g, " ").trim();
    
    // If too short, add context
    if (cleanPrompt.length < 10) {
      cleanPrompt = "A figure in a Tunisian storybook scene, traditional illustration style";
    }

    console.log(`[Safety Agent] Sanitized (${attempt}): ${cleanPrompt.substring(0, 80)}...`);
    return cleanPrompt;
  } catch (e) {
    console.error("[Safety Agent] Error:", e);
    return `A person in a traditional Tunisian paper storybook illustration, vintage aesthetic`;
  }
}

/**
 * Generate image using Kie.ai Nano Banana API (Tunisian Paper Style + Face Lock)
 */
export async function generateImageWithNanoBanana(
  prompt: string,
  childPhotoUrl?: string,
  characterName: string = "the subject",
  attempt: number = 1
): Promise<string> {
  // Support both remote URLs and local base64 data
  const isI2I = !!(childPhotoUrl && (childPhotoUrl.startsWith('http') || childPhotoUrl.startsWith('data:')));
  const finalSafePrompt = await sanitizePrompt(prompt, characterName, attempt);

  const CALLBACK_URL = process.env.NANO_BANANA_CALLBACK_URL || "https://example.com/callback";

  // Progressive prompt simplification based on attempt number
  let finalPrompt = finalSafePrompt;
  
  if (isI2I) {
    if (attempt === 1) {
      finalPrompt = `${finalSafePrompt}, traditional Tunisian storybook style, watercolor illustration, vintage paper texture, hand-drawn aesthetic`;
    } else if (attempt === 2) {
      finalPrompt = `${finalSafePrompt}, traditional storybook illustration, Tunisian style`;
    } else {
      // Last attempt: ultra-simple
      finalPrompt = `Tunisian storybook illustration, watercolor style, traditional aesthetic`;
    }
  } else {
    if (attempt > 1) {
      finalPrompt = `Tunisian scene, traditional storybook illustration`;
    }
  }

  const requestBody: any = {
    prompt: finalPrompt,
    numImages: 1,
    callBackUrl: CALLBACK_URL,
    image_size: "1:1"
  };

  if (isI2I) {
    requestBody.type = "IMAGETOIAMGE";
    requestBody.imageUrls = [childPhotoUrl];
  } else {
    requestBody.type = "TEXTTOIAMGE";
  }

  console.log(`[AI] Nanobanana Request (Attempt ${attempt}, Type: ${requestBody.type}): "${finalPrompt}"`);

  try {
    const response = await fetchWithTimeout(
      `${NANO_BANANA_BASE}/api/v1/nanobanana/generate`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${NANO_BANANA_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      300000, // 5 minutes for image generation (VERY slow!)
      1
    );

    const result = await response.json();

    // Handle safety filter errors (code 500 or 501)
    if ((result.code === 500 || result.code === 501 || result.msg?.includes("filtered")) && attempt < 3) {
      console.warn(`[AI] Safety filter hit (Code ${result.code}, Attempt ${attempt}). Simplifying prompt...`);
      return generateImageWithNanoBanana("A scene with figures in traditional setting", childPhotoUrl, characterName, attempt + 1);
    }

    if (!response.ok || result.code !== 200) {
      throw new Error(`NanoBanana API Error (Code ${result.code}): ${result.msg || response.statusText}`);
    }

    const taskId = result.data?.taskId;
    if (!taskId) throw new Error(`NanoBanana Error: ${result.msg || "No taskId returned"}`);
    
    console.log(`[AI] Successfully submitted image generation, taskId: ${taskId}`);
    return taskId;
  } catch (error) {
    console.error(`[AI] Nanobanana Error (Attempt ${attempt}):`, error);
    if (attempt < 3) {
      console.log(`[AI] Retrying image generation (Attempt ${attempt + 1}/3)...`);
      // Try with even simpler prompt
      return generateImageWithNanoBanana("A Tunisian storybook scene", childPhotoUrl, characterName, attempt + 1);
    }
    throw error;
  }
}

/**
 * Poll task status with timeout handling
 */
export async function getTaskStatus(taskId: string): Promise<any> {
  try {
    const response = await fetchWithTimeout(
      `${NANO_BANANA_BASE}/api/v1/nanobanana/record-info?taskId=${taskId}`,
      {
        method: "GET",
        headers: { "Authorization": `Bearer ${NANO_BANANA_API_KEY}` },
      },
      30000, // 30 seconds for polling
      2
    );

    const result = await response.json();
    const data = result.data;

    let status: "pending" | "processing" | "completed" | "failed" = "processing";
    if (data?.successFlag === 1) status = "completed";
    else if (data?.successFlag === -1 || data?.successFlag === 3) status = "failed";

    return {
      status,
      result: data?.response?.resultImageUrl ? { images: [{ url: data.response.resultImageUrl }] } : undefined,
      error: data?.errorMessage || result.msg,
    };
  } catch (error) {
    console.error("[getTaskStatus] Polling error:", error);
    return {
      status: "processing",
      error: "Polling timeout or network error",
    };
  }
}

export async function getImageUrlFromTask(taskId: string): Promise<string | null> {
  const status = await getTaskStatus(taskId);
  if (status.status === "completed" && status.result?.images?.[0]?.url) {
    return status.result.images[0].url;
  }
  return null;
}
