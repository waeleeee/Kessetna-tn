// @ts-nocheck
import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { generateStoryWithGPT, generateImageWithNanoBanana, getImageUrlFromTask } from "./kieai";
import * as db from "./db";
import { storagePut } from "./storage";

// Memory fallback for testing without DB
const memoryStore = {
  stories: new Map(),
  images: new Map(),
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  story: router({
    create: protectedProcedure
      .input(
        z.object({
          childName: z.string().min(1),
          childAge: z.number().min(3).max(12),
          educationalGoal: z.string().min(1),
          problemDescription: z.string().min(1),
          childPhotoBase64: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const storyId = Math.floor(Math.random() * 1000000);
        let childPhotoUrl: string | undefined;

        // 1. Photo
        if (input.childPhotoBase64) {
          try {
            const buffer = Buffer.from(input.childPhotoBase64, "base64");
            const { url } = await storagePut(`photos/${storyId}.jpg`, buffer, "image/jpeg");
            childPhotoUrl = url;
          } catch (e) { console.error("Upload failed:", e); }
        }

        // 2. GPT Story
        const prompt = `
أنت كاتب قصص أطفال محترف. اكتب قصة باللغة العربية الفصحى للطفل ${input.childName} (${input.childAge} سنة).
المشكلة: ${input.problemDescription}.
الهدف التربوي: ${input.educationalGoal}.

المتطلبات:
1. يجب أن تكون القصة باللغة العربية الفصحى السليمة.
2. يجب أن تكون جميع الكلمات مشكولة شكلاً تاماً لمساعدة الطفل على القراءة.
3. ابدأ بالقصة مباشرة دون أي مقدمات.
4. قسم القصة إلى فقرتين مشوقتين.
        `.trim();
        
        const storyText = await generateStoryWithGPT(prompt);

        // 3. Save to Memory (and try DB)
        const storyObj = { 
          id: storyId, 
          userId: ctx.user.id, 
          childName: input.childName, 
          storyText, 
          status: "completed" 
        };
        memoryStore.stories.set(storyId, storyObj);
        
        try { await db.createStory(storyObj); } catch (e) { console.warn("DB skip"); }

        // 4. Images
        if (childPhotoUrl) {
          const imagePrompt = `
CRITICAL: HIGH CHARACTER CONSISTENCY REQUIRED.
The main character MUST BE AN EXACT MATCH to the child in the reference photo. 
REPLICATE THEIR FACE, HAIR, AND EXACT CLOTHING from the photo.
Scene to illustrate: "${storyText.slice(0, 200)}".
Setting: Traditional Tunisian background (Sidi Bou Said style white walls and blue doors).
Style: Premium Anime/Ghibli illustration, high detail, vibrant, safe for kids.
          `.trim();

          try {
            const taskId = await generateImageWithNanoBanana(imagePrompt, childPhotoUrl);
            const imgObj = { storyId, taskId, status: "processing", url: null };
            memoryStore.images.set(storyId, [imgObj]);
            try { await db.createGeneratedImage(imgObj); } catch (e) {}
          } catch (e) { console.error("Image failed:", e); }
        }

        return { storyId, storyText, hasImages: !!childPhotoUrl };
      }),

    getStatus: protectedProcedure
      .input(z.object({ storyId: z.number() }))
      .query(async ({ input }) => {
        const story = memoryStore.stories.get(input.storyId);
        const images = memoryStore.images.get(input.storyId) || [];

        // Try to update image status
        for (const img of images) {
          if (img.status === "processing") {
            try {
              const url = await getImageUrlFromTask(img.taskId);
              if (url) {
                img.url = url;
                img.status = "completed";
              }
            } catch (e) {}
          }
        }

        return { 
          story: story || { id: input.storyId, status: "completed", storyText: "" }, 
          images: images.map(img => ({ url: img.url, status: img.status })) 
        };
      }),
  }),
});
