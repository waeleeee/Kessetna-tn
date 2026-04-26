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
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

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

          // 2. GPT Story (New Multi-Scene IA Agent)
          let generatedStory: any;
          try {
            const prompt = `اكتب قصة للأطفال عن ${input.childName} (${input.childAge} سنة). المشكلة: ${input.problemDescription}. الهدف: ${input.educationalGoal}.`.trim();
            generatedStory = await generateStoryWithGPT(prompt, "neutral");
          } catch (e) {
            generatedStory = {
              title: "قصة سحرية",
              scenes: [
                { text: `كان يا مكان... قصة عن ${input.childName}.`, imagePrompt: "A happy child" },
                { text: "وعاشوا في سعادة أبدية.", imagePrompt: "A happy child celebrating" }
              ],
              characterDescription: "A young child"
            };
          }

          // 3. Image Task for first scene
          let taskId: string | undefined;
          const imageRef = input.childPhotoBase64 
            ? `data:image/jpeg;base64,${input.childPhotoBase64}` 
            : undefined;

          if (imageRef && generatedStory.scenes.length > 0) {
            try {
              const fullPrompt = `${generatedStory.characterDescription}, ${generatedStory.scenes[0].imagePrompt}`;
              taskId = await generateImageWithNanoBanana(fullPrompt, imageRef, input.childName);
            } catch (e) { console.error("Image failed:", e); }
          }

          console.log(`[story.create] Generated story with ${generatedStory.scenes.length} scenes. First image taskId: ${taskId}`);

          return { 
            title: generatedStory.title,
            scenes: generatedStory.scenes,
            characterDescription: generatedStory.characterDescription,
            taskId,
            childName: input.childName
          };
        } catch (error) {
          console.error("[story.create] Error:", error);
          return { error: "Failed to create story" };
        }
      }),

    pollImage: publicProcedure
      .input(z.object({ taskId: z.string() }))
      .query(async ({ input }) => {
        try {
          const status = await getTaskStatus(input.taskId);
          let imageUrl = status.result?.images?.[0]?.url;

          if (status.status === "completed" && imageUrl) {
            try {
              // Local save path
              const publicDir = path.join(process.cwd(), "client", "public");
              const uploadsDir = path.join(publicDir, "uploads", "generated-images");
              
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }

              const fileName = `${input.taskId}.jpg`;
              const filePath = path.join(uploadsDir, fileName);

              // Only download if we don't have it yet
              if (!fs.existsSync(filePath)) {
                const response = await fetch(imageUrl);
                const buffer = Buffer.from(await response.arrayBuffer());
                fs.writeFileSync(filePath, buffer);
                console.log(`[Storage] Saved image locally: ${fileName}`);
              }

              // Return the local URL so the frontend uses the local version
              imageUrl = `/uploads/generated-images/${fileName}`;
            } catch (err) {
              console.error("[Storage] Failed to save image locally:", err);
              // Fallback to original remote URL if local save fails
            }
          }

          return {
            status: status.status,
            url: imageUrl,
            error: status.error
          };
        } catch (e) {
          return { status: "failed", error: e.message };
        }
      }),

    generateRemaining: protectedProcedure
      .input(
        z.object({
          characterDescription: z.string(),
          scenes: z.array(z.object({ text: z.string(), imagePrompt: z.string() })),
          firstImageTaskId: z.string(),
          childName: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          console.log(`[generateRemaining] Starting for ${input.childName}, scenes: ${input.scenes.length}`);
          
          // First, get the URL of the first generated image
          const firstImageStatus = await getTaskStatus(input.firstImageTaskId);
          if (firstImageStatus.status !== "completed" || !firstImageStatus.result?.images?.[0]?.url) {
            throw new Error("First image not ready yet. Wait for it to complete before generating remaining scenes.");
          }
          
          const firstImageUrl = firstImageStatus.result.images[0].url;
          console.log(`[generateRemaining] Using first image as reference: ${firstImageUrl}`);

          const taskIds: string[] = [];
          
          // Generate images for ALL remaining scenes (starting from scene 1)
          for (let i = 1; i < input.scenes.length; i++) {
            if (!input.scenes[i]) continue;
            
            try {
              const fullPrompt = `${input.characterDescription}, ${input.scenes[i].imagePrompt}`;
              // Use the first image as reference for consistency
              const taskId = await generateImageWithNanoBanana(fullPrompt, firstImageUrl, input.childName);
              taskIds.push(taskId);
              console.log(`[generateRemaining] Scene ${i} taskId: ${taskId}`);
            } catch (e) { 
              console.error(`[generateRemaining] Scene ${i} failed:`, e); 
              taskIds.push("");
            }
          }
          
          console.log(`[generateRemaining] Generated ${taskIds.filter(id => id).length} of ${input.scenes.length - 1} images`);
          return { taskIds };
        } catch (error) {
          console.error("[generateRemaining] Error:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: error.message || "Failed to generate remaining scenes"
          });
        }
      }),

    finalize: protectedProcedure
      .input(z.object({
        title: z.string(),
        scenes: z.array(z.object({ text: z.string(), imagePrompt: z.string() })),
        imageUrls: z.array(z.string())
      }))
      .mutation(async ({ input }) => {
        try {
          // Validate all scenes have images
          if (input.imageUrls.length !== input.scenes.length) {
            throw new Error(`Story incomplete: ${input.imageUrls.length} images but ${input.scenes.length} scenes. Waiting for all images to be generated.`);
          }
          
          // Validate no empty URLs
          if (input.imageUrls.some(url => !url)) {
            throw new Error("Some images are missing or failed to generate");
          }

          console.log(`[finalize] Finalizing story with ${input.scenes.length} scenes and ${input.imageUrls.length} images`);

          const publicDir = path.join(process.cwd(), "client", "public");
          const storiesDir = path.join(publicDir, "stories");
          if (!fs.existsSync(storiesDir)) fs.mkdirSync(storiesDir, { recursive: true });

          let finalHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <title>حكاية ${input.title}</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #f7f1e3; margin: 0; padding: 0; }
        .page { background: #f7f1e3; height: 297mm; width: 210mm; display: flex; flex-direction: column; align-items: center; padding: 20mm; box-sizing: border-box; page-break-after: always; }
        img { max-width: 100%; max-height: 50%; border-radius: 15px; margin-bottom: 30px; object-fit: contain; }
        p { font-size: 28px; line-height: 1.8; text-align: right; color: #333; width: 100%; font-weight: bold; }
        h1 { text-align: center; color: #8B4513; margin-bottom: 40px; font-size: 40px; }
    </style>
</head>
<body>
    <div class="page" style="justify-content: center;">
      <h1 style="font-size: 60px;">حكاية ${input.title}</h1>
    </div>
    ${input.scenes.map((scene, i) => `
        <div class="page">
            <img src="${input.imageUrls[i] || ""}" alt="Scene ${i+1}">
            <p>${scene.text}</p>
        </div>
    `).join("")}
</body>
</html>
          `;

          // Embed local images as base64 for Puppeteer to render them offline
          for (const url of input.imageUrls) {
            if (url && url.startsWith('/uploads/')) {
              try {
                const localPath = path.join(publicDir, url.replace('/uploads/', 'uploads/'));
                if (fs.existsSync(localPath)) {
                  const b64 = fs.readFileSync(localPath).toString('base64');
                  finalHtml = finalHtml.replace(`src="${url}"`, `src="data:image/jpeg;base64,${b64}"`);
                }
              } catch (e) { console.error("Base64 error", e); }
            }
          }

          // Generate PDF
          console.log("[Story] Launching Puppeteer to create PDF...");
          const browser = await puppeteer.launch({ 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox']
          });
          const page = await browser.newPage();
          await page.setContent(finalHtml, { waitUntil: 'networkidle0' });
          
          const fileName = `story-${Date.now()}.pdf`;
          const filePath = path.join(storiesDir, fileName);
          
          await page.pdf({ 
            path: filePath, 
            format: 'A4', 
            printBackground: true 
          });
          
          await browser.close();

          console.log(`[Story] Finalized and saved: ${fileName}`);
          return { success: true, url: `/stories/${fileName}` };
        } catch (e) {
          console.error("Failed to finalize story", e);
          return { success: false };
        }
      }),
  }),
});
