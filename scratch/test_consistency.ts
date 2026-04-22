import { generateImageWithNanoBanana, getTaskStatus } from "../server/kieai";
import fs from 'fs';
import "dotenv/config";

async function test() {
  console.log("--- Starting Consistency Test ---");
  // Very simple prompt to see if the face matching works without clashing descriptions
  const visualPrompt = "A 10-year-old boy named Muhammad standing in a Tunisian village, smiling.";
  
  const filePath = 'c:\\Users\\Wael_\\Downloads\\boy and girl kessa\\dist\\public\\uploads\\child-photos\\1-1776812362047_dd289d84.jpg';
  const fileData = fs.readFileSync(filePath);
  const base64 = `data:image/jpeg;base64,${fileData.toString('base64')}`;

  try {
    console.log("Generating Image...");
    // Using the user's previous successful prompt style
    const promptWithRef = `MATCH THE HERO'S FACE AND CLOTHING FROM THE REFERENCE PHOTO: ${visualPrompt}`;
    
    const taskId = await generateImageWithNanoBanana(promptWithRef, base64);
    console.log("Task ID:", taskId);

    let status = "processing";
    let attempts = 0;
    while (status === "processing" && attempts < 25) {
      const task = await getTaskStatus(taskId);
      status = task.status;
      if (status === "completed") {
        console.log("Result URL:", task.result?.images?.[0]?.url);
        break;
      }
      await new Promise(r => setTimeout(r, 5000));
      attempts++;
    }
  } catch (error) {
    console.error("Test failed:", error);
  }
}

test();
