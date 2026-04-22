import { generateImageWithNanoBanana, getTaskStatus } from "../server/kieai";
import fs from 'fs';
import "dotenv/config";

async function test() {
  console.log("--- Starting Base64 Test ---");
  const visualPrompt = "A 10-year-old boy named Muhammad in a Tunisian village, smiling while running and playing with friends in a sunny courtyard.";
  
  const filePath = 'c:\\Users\\Wael_\\Downloads\\boy and girl kessa\\dist\\public\\uploads\\child-photos\\1-1776812362047_dd289d84.jpg';
  const fileData = fs.readFileSync(filePath);
  const base64 = `data:image/jpeg;base64,${fileData.toString('base64')}`;

  try {
    console.log("1. Generating Image with Nanobanana using Base64 URI...");
    const taskId = await generateImageWithNanoBanana(visualPrompt, base64);
    console.log("Task ID:", taskId);

    console.log("\n2. Polling for Image Result...");
    let status = "processing";
    let attempts = 0;
    while (status === "processing" && attempts < 20) {
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
