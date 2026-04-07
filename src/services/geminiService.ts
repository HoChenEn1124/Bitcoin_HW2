import { GoogleGenAI } from "@google/genai";

// Initialize Gemini API in the frontend
// process.env.GEMINI_API_KEY is injected by Vite
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function getMNAVInsights(data: any) {
  const model = "gemini-3-flash-preview";
  
  const prompt = `
    Analyze the following financial data for MicroStrategy (MSTR) and its Bitcoin holdings:
    ${JSON.stringify(data, null, 2)}
    
    Provide a concise summary including:
    1. Current mNAV (Modified Net Asset Value) status.
    2. Premium/Discount to NAV analysis.
    3. Recent trends in stock price vs Bitcoin price.
    4. Potential risks or opportunities for investors.
    
    Format the output in clean Markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to generate insights at this time. Please check your API key configuration.";
  }
}
