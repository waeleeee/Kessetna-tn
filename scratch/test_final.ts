import { generateStoryWithGPT, generateImageWithNanoBanana, getTaskStatus } from "../server/kieai";
import fs from 'fs';
import "dotenv/config";

async function test() {
  console.log("--- Starting FINAL Base64 Test ---");
  const childName = "محمد";
  const childAge = 10;
  const problemDescription = "ياكل برشا لين سمن برشا";
  const educationalGoal = "نحبو يحسن روحو و يندمج مع صحابو";

  const prompt = `اكتب قصة للأطفال عن ${childName} (${childAge} سنة). المشكلة: ${problemDescription}. الهدف: ${educationalGoal}.`.trim();
  
  const filePath = 'c:\\Users\\Wael_\\Downloads\\boy and girl kessa\\dist\\public\\uploads\\child-photos\\1-1776812362047_dd289d84.jpg';
  const fileData = fs.readFileSync(filePath);
  const base64 = `data:image/jpeg;base64,${fileData.toString('base64')}`;

  try {
    console.log("1. Generating Story & Visual Prompt...");
    const result = await generateStoryWithGPT(prompt);
    console.log("Story (First 50 chars):", result.story.substring(0, 50) + "...");
    console.log("Visual Prompt:", result.visualPrompt);

    console.log("\n2. Generating Image with Nanobanana using DIRECT BASE64...");
    // Passing the base64 URI directly as a string
    const taskId = await generateImageWithNanoBanana(result.visualPrompt, base64);
    console.log("Task ID:", taskId);

    console.log("\n3. Polling for Image Result...");
    let status = "processing";
    let attempts = 0;
    while (status === "processing" && attempts < 25) {
      const task = await getTaskStatus(taskId);
      status = task.status;
      if (status === "completed") {
        console.log("\n--- IMAGE COMPLETED ---");
        console.log("Result URL:", task.result?.images?.[0]?.url);
        break;
      } else if (status === "failed") {
        console.log("\n--- IMAGE FAILED ---");
        console.log("Error:", task.error);
        break;
      }
      console.log(`Attempt ${attempts + 1}: Status is ${status}...`);
      await new Promise(r => setTimeout(r, 5000));
      attempts++;
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

test();
