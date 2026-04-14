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

// DeepSeek Client
const getDeepSeekClient = () => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment variables.");
  }
  return new OpenAI({
    apiKey: apiKey,
    baseURL: "https://api.deepseek.com",
  });
};

// API Routes
app.get("/api/health", (req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  res.json({ 
    status: "ok", 
    time: new Date().toISOString(), 
    env: process.env.NODE_ENV,
    hasApiKey: !!apiKey,
    keyPrefix: apiKey ? `${apiKey.slice(0, 3)}***` : "none",
    vercel: process.env.VERCEL === "1"
  });
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const deepseek = getDeepSeekClient();
    console.log("Generating with prompt:", prompt.slice(0, 50) + "...");

    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "你是一位顶级的小红书/抖音爆款文案专家。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    if (!response.choices[0].message.content) {
      throw new Error("Empty response from DeepSeek");
    }

    res.json({ text: response.choices[0].message.content });
  } catch (error: any) {
    console.error("DeepSeek Error:", error);
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    res.status(status).json({ 
      error: message, 
      details: error.toString(),
      hint: "Please ensure DEEPSEEK_API_KEY is correctly set in Vercel environment variables."
    });
  }
});

app.post("/api/search-keywords", async (req, res) => {
  try {
    const { query } = req.body;
    const deepseek = getDeepSeekClient();
    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "你是一个关键词提取专家。" },
        { role: "user", content: `请为以下主题提取3个极其精简的英文搜索关键词（用于图库搜索）："${query}"。仅返回关键词，用空格分隔。` }
      ],
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
