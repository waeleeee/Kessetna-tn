import { generateImageWithNanoBanana, getTaskStatus } from "../server/kieai";
import "dotenv/config";

async function test() {
  console.log("--- Starting Character Consistency Test (Public URL) ---");
  const childPhotoUrl = "https://tmpfiles.org/dl/34711936/1-1776812362047_dd289d84.jpg";
  const visualPrompt = "A 10-year-old boy named Muhammad standing in a Tunisian village, smiling.";
  
  // Use the original code's prompt style that the user liked
  const promptWithRef = `MATCH THE HERO'S FACE AND CLOTHING FROM THE REFERENCE PHOTO: ${visualPrompt}`;

  try {
    console.log("Generating Image with Public URL...");
    const taskId = await generateImageWithNanoBanana(promptWithRef, childPhotoUrl);
    console.log("Task ID:", taskId);

    let status = "processing";
    let attempts = 0;
    while (status === "processing" && attempts < 25) {
      const task = await getTaskStatus(taskId);
      status = task.status;
      if (status === "completed") {
        console.log("--- IMAGE COMPLETED ---");
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
