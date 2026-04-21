import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { generateStoryWithGPT, generateImageWithNanoBanana, getImageUrlFromTask } from "./kieai";
import { createStory, getStoryById, updateStory, createGeneratedImage, getImagesByStoryId, updateGeneratedImage } from "./db";
import { storagePut } from "./storage";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  story: router({
    /**
     * Create a new story with optional image generation
     */
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
          // 1. Handle child photo upload if provided
          let childPhotoUrl: string | undefined;
          if (input.childPhotoBase64) {
            try {
              const buffer = Buffer.from(input.childPhotoBase64, "base64");
              const { url } = await storagePut(
                `child-photos/${ctx.user.id}-${Date.now()}.jpg`,
                buffer,
                "image/jpeg"
              );
              childPhotoUrl = url;
            } catch (error) {
              console.error("Photo upload failed:", error);
              throw new TRPCError({
                code: "INTERNAL_SERVER_ERROR",
                message: "فشل تحميل صورة الطفل. يرجى المحاولة مرة أخرى.",
              });
            }
          }

          // 2. Create story record in database
          let storyId: number;
          try {
            const storyResult = await createStory({
              userId: ctx.user.id,
              childName: input.childName,
              childAge: input.childAge,
              educationalGoal: input.educationalGoal,
              problemDescription: input.problemDescription,
              childPhotoUrl,
              status: "generating",
            });

            // Extract story ID from insert result
            if (!storyResult || storyResult.length === 0 || typeof storyResult[0].id !== "number") {
              throw new Error("Failed to get story ID from database");
            }
            storyId = storyResult[0].id;
          } catch (error) {
            console.error("Story creation failed:", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "فشل إنشاء القصة. يرجى المحاولة مرة أخرى.",
            });
          }

          // 3. Generate story text using GPT (synchronous)
          let storyText: string;
          try {
            const prompt = `
أنت كاتب قصص أطفال محترف. اكتب قصة باللغة العربية الفصحى للطفل ${input.childName} (${input.childAge} سنة).
المشكلة: ${input.problemDescription}.
الهدف التربوي: ${input.educationalGoal}.

المتطلبات:
1. يجب أن تكون القصة باللغة العربية الفصحى السليمة.
2. يجب أن تكون جميع الكلمات مشكولة شكلاً تاماً (Tashkeel) لمساعدة الطفل على القراءة.
3. ابدأ بالقصة مباشرة دون أي مقدمات.
4. قسم القصة إلى فقرتين مشوقتين.
            `.trim();

            storyText = await generateStoryWithGPT(prompt);
          } catch (error) {
            console.error("Story generation failed:", error);
            await updateStory(storyId, { status: "failed" });
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "فشل إنشاء القصة. يرجى المحاولة مرة أخرى.",
            });
          }

          // 4. Update story with text and mark as completed
          try {
            await updateStory(storyId, {
              storyText,
              status: "completed",
            });
          } catch (error) {
            console.error("Story update failed:", error);
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "فشل حفظ القصة.",
            });
          }

          // 5. Generate images for each paragraph if photo was provided
          if (childPhotoUrl) {
            const paragraphs = storyText.split("\n").filter(p => p.trim().length > 0).slice(0, 2);
            
            for (let i = 0; i < paragraphs.length; i++) {
              const paragraph = paragraphs[i];
              const imagePrompt = `
CRITICAL: HIGH CHARACTER CONSISTENCY REQUIRED.
The main character MUST BE AN EXACT MATCH to the child in the reference photo. 
REPLICATE THEIR FACE, HAIR, AND EXACT CLOTHING from the photo.
Scene to illustrate: "${paragraph}".
Setting: Traditional Tunisian background (Sidi Bou Said style white walls and blue doors).
Style: Premium Anime/Ghibli illustration, high detail, vibrant, safe for kids.
              `.trim();

              try {
                const taskId = await generateImageWithNanoBanana(imagePrompt, childPhotoUrl);
                
                // Create image record with task ID
                await createGeneratedImage({
                  storyId,
                  paragraphIndex: i,
                  prompt: imagePrompt,
                  taskId,
                  status: "processing",
                });
              } catch (error) {
                console.error(`Failed to generate image for paragraph ${i}:`, error);
              }
            }
          }

          return {
            storyId,
            storyText,
            hasImages: !!childPhotoUrl,
          };
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error;
          }
          console.error("Story creation error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
          });
        }
      }),

    /**
     * Get story status and poll for image generation
     */
    getStatus: protectedProcedure
      .input(z.object({ storyId: z.number() }))
      .query(async ({ ctx, input }) => {
        try {
          const story = await getStoryById(input.storyId);

          if (!story) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "لم يتم العثور على القصة",
            });
          }

          // Check authorization
          if (story.userId !== ctx.user.id) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "ليس لديك صلاحية للوصول إلى هذه القصة",
            });
          }

          const images = await getImagesByStoryId(input.storyId);

          // Poll for image generation status only if story is still generating
          if (story.status === "generating" || story.status === "completed") {
            for (const image of images) {
              if (image.status === "processing") {
                try {
                  const remoteUrl = await getImageUrlFromTask(image.taskId);
                  if (remoteUrl) {
                    try {
                      // Download the image data
                      const imgResp = await fetch(remoteUrl);
                      const buffer = await imgResp.arrayBuffer();
                      
                      // Save it locally
                      const { url: localUrl } = await storagePut(
                        `generated-images/${story.id}-${image.paragraphIndex}.jpg`,
                        Buffer.from(buffer),
                        "image/jpeg"
                      );

                      await updateGeneratedImage(image.id, {
                        imageUrl: localUrl,
                        status: "completed",
                      });
                    } catch (downloadError) {
                      console.error(`Failed to download and save image:`, downloadError);
                      // Fallback to remote URL if local save fails
                      await updateGeneratedImage(image.id, {
                        imageUrl: remoteUrl,
                        status: "completed",
                      });
                    }
                  }
                } catch (error) {
                  console.error(`Failed to get image status for task ${image.taskId}:`, error);
                  await updateGeneratedImage(image.id, {
                    status: "failed",
                  });
                }
              }
            }
          }

          // Fetch updated images
          const updatedImages = await getImagesByStoryId(input.storyId);

          return {
            story,
            images: updatedImages,
          };
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error;
          }
          console.error("Get story status error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "فشل الحصول على حالة القصة",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
