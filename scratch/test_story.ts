import { generateStoryWithGPT } from "../server/kieai";
import "dotenv/config";

async function test() {
  console.log("--- Starting Test ---");
  const childName = "محمد";
  const childAge = 10;
  const problemDescription = "ياكل برشا لين سمن برشا";
  const educationalGoal = "نحبو يحسن روحو و يندمج مع صحابو";

  const prompt = `اكتب قصة للأطفال عن ${childName} (${childAge} سنة). المشكلة: ${problemDescription}. الهدف: ${educationalGoal}.`.trim();
  
  console.log("Input Prompt:", prompt);
  console.log("Sending to GPT...");

  try {
    const result = await generateStoryWithGPT(prompt);
    console.log("\n--- GENERATED STORY (with Tashkeel) ---");
    console.log(result.story);
    console.log("\n--- GENERATED VISUAL PROMPT ---");
    console.log(result.visualPrompt);
  } catch (error) {
    console.error("Test failed:", error);
  }
}

test();
