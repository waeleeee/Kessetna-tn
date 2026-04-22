import { generateStoryWithGPT, generateImageWithNanoBanana, getTaskStatus } from "../server/kieai";
import "dotenv/config";

async function test() {
  console.log("--- Starting Full Test ---");
  const childName = "محمد";
  const childAge = 10;
  const problemDescription = "ياكل برشا لين سمن برشا";
  const educationalGoal = "نحبو يحسن روحو و يندمج مع صحابو";

  const prompt = `اكتب قصة للأطفال عن ${childName} (${childAge} سنة). المشكلة: ${problemDescription}. الهدف: ${educationalGoal}.`.trim();
  
  try {
    console.log("1. Generating Story & Visual Prompt...");
    const result = await generateStoryWithGPT(prompt);
    console.log("Story:", result.story.substring(0, 100) + "...");
    console.log("Visual Prompt:", result.visualPrompt);

    console.log("\n2. Generating Image with Nanobanana...");
    // Using a sample public image since the local one isn't reachable by the API
    const sampleImageUrl = "https://images.pexels.com/photos/1619697/pexels-photo-1619697.jpeg"; 
    const taskId = await generateImageWithNanoBanana(result.visualPrompt, sampleImageUrl);
    console.log("Task ID:", taskId);

    console.log("\n3. Polling for Image Result...");
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
