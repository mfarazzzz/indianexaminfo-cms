import { GoogleGenerativeAI } from "@google/generative-ai";

export function getGeminiClient(apiKey: string, model: string) {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model });
}

export async function generateWithGemini(
  prompt: string,
  apiKey: string,
  model: string = "gemini-1.5-flash"
): Promise<string> {
  if (!apiKey) throw new Error("Gemini API key not configured. Set it in Settings → AI.");
  const client = getGeminiClient(apiKey, model);
  const result = await client.generateContent(prompt);
  return result.response.text();
}
