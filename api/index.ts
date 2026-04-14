import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import OpenAI from "openai";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

// Gemini/OpenAI Compatible Client
const getAIClient = () => {
  // Force the provided key to ensure it's being used correctly
  const apiKey = "sk-jkHCKxMTpWnWMh5xDOBhKvWqI1rTBjFA2Aq9u3psyynQOm6f";
  
  console.log(`[AI] Initializing client with key: ${apiKey.slice(0, 7)}...`);
  
  return new OpenAI({
    apiKey: apiKey.trim(),
    baseURL: "https://vip.aipro.love/v1",
  });
};

// API Routes
app.get("/api/health", (req, res) => {
  const apiKey = "sk-jkHCKxMTpWnWMh5xDOBhKvWqI1rTBjFA2Aq9u3psyynQOm6f";
  
  res.json({ 
    status: "ok", 
    time: new Date().toISOString(), 
    env: process.env.NODE_ENV,
    hasApiKey: !!apiKey,
    keyPrefix: apiKey ? `${apiKey.slice(0, 7)}***` : "none",
    baseUrl: "https://vip.aipro.love/v1",
    models: ["gemini-3.1-pro-high", "gemini-3.1-pro-low", "gemini-1.5-flash", "gpt-4o-mini", "deepseek-chat"],
    strategy: "optimized-fallback",
    vercel: process.env.VERCEL === "1",
    note: "Using optimized fallback with 20s per-model timeout"
  });
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const ai = getAIClient();
    
    // Try models in order of preference - further reduced for maximum speed
    const models = [
      "gemini-3.1-pro-high",
      "gemini-1.5-flash", 
      "gpt-4o-mini"
    ];
    let lastError = null;

    for (const model of models) {
      try {
        console.log(`[AI] Attempting generation with model: ${model}`);
        const response = await ai.chat.completions.create({
          model: model,
          messages: [
            { role: "system", content: "你是一位顶级的小红书/抖音爆款文案专家。" },
            { role: "user", content: prompt }
          ],
          temperature: 0.7,
        }, {
          timeout: 20000, // 20s timeout per model
        });

        if (response.choices[0].message.content) {
          console.log(`[AI] Success with model: ${model}`);
          return res.json({ text: response.choices[0].message.content, modelUsed: model });
        }
      } catch (error: any) {
        console.error(`[AI] Failed with model ${model}:`, error.message);
        lastError = error;
        // If it's a 401, don't bother retrying other models as it's a key issue
        if (error.status === 401) break;
        // Continue to next model for 503 or other transient errors
      }
    }

    // If we get here, all models failed
    throw lastError || new Error("All models failed to generate a response");

  } catch (error: any) {
    console.error("AI Error Details:", JSON.stringify(error, null, 2));
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    res.status(status).json({ 
      error: message, 
      details: error.toString(),
      requestId: error.headers?.['request-id'] || error.headers?.['x-request-id'] || 'unknown'
    });
  }
});

app.post("/api/search-keywords", async (req, res) => {
  try {
    const { query } = req.body;
    const ai = getAIClient();
    const response = await ai.chat.completions.create({
      model: "gemini-3.1-pro-low",
      messages: [
        { role: "system", content: "你是一个关键词提取专家。" },
        { role: "user", content: `请为以下主题提取3个极其精简的英文搜索关键词（用于图库搜索）："${query}"。仅返回关键词，用空格分隔。` }
      ],
    }, {
      timeout: 15000, // 15s timeout for keywords
    });

    res.json({ text: response.choices[0].message.content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Vite middleware setup (Only for local development)
if (process.env.NODE_ENV !== "production" && process.env.VERCEL !== "1") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
 else if (process.env.VERCEL !== "1") {
  // Only serve static files manually if NOT on Vercel
  // Vercel handles static serving natively from the 'dist' folder
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Export for Vercel
export default app;

// Only listen if not in a serverless environment
if (process.env.VERCEL !== "1") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
