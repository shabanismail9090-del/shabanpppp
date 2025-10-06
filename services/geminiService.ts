
import { GoogleGenAI } from "@google/genai";
import type { Language } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const translateText = async (
  text: string,
  sourceLang: Language,
  targetLang: Language
): Promise<string> => {
  if (!text.trim()) {
    return "";
  }

  const prompt = `
    You are an expert translator. Translate the following text from ${sourceLang} to ${targetLang}.
    Do not add any commentary, preamble, or explanation. Only return the translated text.
    Preserve the original formatting (like line breaks) as much as possible.

    Text to translate:
    ---
    ${text}
    ---
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        // Disable thinking for faster translation response
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    
    return response.text.trim();
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Failed to translate text. Please check the API key and try again.");
  }
};
