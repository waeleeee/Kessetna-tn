import { ENV } from "./_core/env";

const KIE_AI_API_BASE = "https://api.kie.ai";
const KIE_AI_API_KEY = process.env.KIE_AI_API_KEY || "";

interface KieAiChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface KieAiImageTaskResponse {
  task_id: string;
}

interface KieAiTaskStatusResponse {
  status: "pending" | "processing" | "completed" | "failed";
  result?: {
    images?: Array<{
      url: string;
    }>;
  };
  error?: string;
}

/**
 * Generate story text using Kie.ai GPT API (synchronous)
 */
export async function generateStoryWithGPT(prompt: string): Promise<string> {
  if (!KIE_AI_API_KEY) {
    throw new Error("KIE_AI_API_KEY environment variable is not set");
  }

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
          content: "You are a creative Arabic children's story writer. Write engaging, age-appropriate stories that teach valuable lessons.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Kie.ai GPT API error: ${response.status} - ${error}`);
  }

  const data: any = await response.json();
  const storyText = data.choices?.[0]?.message?.content || data.content || data.text;

  if (!storyText) {
    throw new Error("No story text returned from Kie.ai API");
  }

  return storyText;
}

/**
 * Generate image using Kie.ai Nano Banana API (asynchronous)
 * Returns a task_id for polling
 */
export async function generateImageWithNanoBanana(
  prompt: string,
  childPhotoUrl?: string
): Promise<string> {
  // Use the new NanoBanana API key and endpoint provided by the user
  const NANO_BANANA_API_KEY = "8fbad5fe9f8a9b1e4d08dfd2e97a2fad";
  const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";

  // If childPhotoUrl is a local path, we need to read it and convert to Base64
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
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nano-banana",
      prompt,
      // Send the actual image data so the AI can see the child's clothes and face
      image: imageData,
      type: "TEXTTOIAMGE"
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NanoBanana Image API error: ${response.status} - ${error}`);
  }

  const result: any = await response.json();
  const taskId = result.data?.taskId;

  if (!taskId) {
    throw new Error("No taskId returned from NanoBanana API");
  }

  return taskId;
}

/**
 * Poll task status for image generation
 */
export async function getTaskStatus(taskId: string): Promise<any> {
  const NANO_BANANA_API_KEY = "8fbad5fe9f8a9b1e4d08dfd2e97a2fad";
  const NANO_BANANA_BASE = "https://api.nanobananaapi.ai";

  const response = await fetch(`${NANO_BANANA_BASE}/api/v1/nanobanana/record-info?taskId=${taskId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${NANO_BANANA_API_KEY}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`NanoBanana Task Status API error: ${response.status} - ${error}`);
  }

  const result: any = await response.json();
  const data = result.data;

  // Map NanoBanana status to our internal status
  let status: "pending" | "processing" | "completed" | "failed" = "processing";
  if (data.successFlag === 1) status = "completed";
  else if (data.successFlag === -1 || data.errorCode) status = "failed";
  else status = "processing";

  let imageUrl: string | undefined;
  if (data.response && data.response.resultImageUrl) {
    imageUrl = data.response.resultImageUrl;
  }

  return {
    status,
    result: imageUrl ? { images: [{ url: imageUrl }] } : undefined,
    error: data.errorMessage || undefined,
  };
}

/**
 * Get image URL from completed task
 */
export async function getImageUrlFromTask(taskId: string): Promise<string | null> {
  const status = await getTaskStatus(taskId);

  if (status.status === "completed" && status.result?.images?.[0]?.url) {
    return status.result.images[0].url;
  }

  if (status.status === "failed") {
    throw new Error(`Image generation failed: ${status.error || "Unknown error"}`);
  }

  return null;
}
