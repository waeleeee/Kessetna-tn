// @ts-nocheck
import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { generateStoryWithGPT, generateImageWithNanoBanana, getTaskStatus } from "./kieai";
import * as db from "./db";
import { storagePut } from "./storage";

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
        try {
          let childPhotoUrl: string | undefined;

          // 1. Photo
          if (input.childPhotoBase64) {
            try {
              const buffer = Buffer.from(input.childPhotoBase64, "base64");
              const { url } = await storagePut(`photos/${Date.now()}.jpg`, buffer, "image/jpeg");
              childPhotoUrl = url;
            } catch (e) { console.error("Upload failed:", e); }
          }

          // 2. GPT Story
          let storyText: string;
          let visualPrompt: string | undefined;
          try {
            const prompt = `اكتب قصة للأطفال عن ${input.childName} (${input.childAge} سنة). المشكلة: ${input.problemDescription}. الهدف: ${input.educationalGoal}.`.trim();
            const result = await generateStoryWithGPT(prompt);
            storyText = result.story;
            visualPrompt = result.visualPrompt;
          } catch (e) {
            storyText = `كان يا مكان... قصة عن ${input.childName}.`;
            visualPrompt = `Anime illustration of ${input.childName} in Sidi Bou Said.`;
          }

          // 3. Image Task
          let taskId: string | undefined;
          const imageRef = input.childPhotoBase64 
            ? `data:image/jpeg;base64,${input.childPhotoBase64}` 
            : undefined;

          if (imageRef) {
            try {
              // Use the base64 data URI directly for character consistency (works on localhost)
              taskId = await generateImageWithNanoBanana(visualPrompt || input.childName, imageRef);
            } catch (e) { console.error("Image failed:", e); }
          }

          return { storyText, taskId };
        } catch (error) {
          return { storyText: "Error happened", taskId: undefined };
        }
      }),

    pollImage: publicProcedure
      .input(z.object({ taskId: z.string() }))
      .query(async ({ input }) => {
        try {
          const status = await getTaskStatus(input.taskId);
          return {
            status: status.status,
            url: status.result?.images?.[0]?.url,
            error: status.error
          };
        } catch (e) {
          return { status: "failed", error: e.message };
        }
      }),
  }),
});
