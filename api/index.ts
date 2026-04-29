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

// Zhipu AI Client (OpenAI Compatible)
const getZhipuClient = () => {
  const apiKey = process.env.ZHIPUAI_API_KEY;
  if (!apiKey) {
    throw new Error("ZHIPUAI_API_KEY is not set in environment variables.");
  }
  return new OpenAI({
    apiKey: apiKey,
    baseURL: "https://open.bigmodel.cn/api/paas/v4/",
  });
};

// API Routes
app.get("/api/health", (req, res) => {
  const apiKey = process.env.ZHIPUAI_API_KEY;
  res.json({ 
    status: "ok", 
    time: new Date().toISOString(), 
    env: process.env.NODE_ENV,
    hasApiKey: !!apiKey,
    keyPrefix: apiKey ? `${apiKey.slice(0, 3)}***` : "none",
    model: "glm-5.1" // Latest flagship model
  });
});

app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const zhipu = getZhipuClient();
    console.log("Generating with Zhipu AI (GLM-5.1), prompt:", prompt.slice(0, 50) + "...");

    const response = await zhipu.chat.completions.create({
      model: "glm-5.1", 
      messages: [
        { role: "system", content: "你是一位顶级的小红书/抖音爆款文案专家，擅长创作高吸引力和转化率的内容。" },
        { role: "user", content: prompt }
      ],
      // @ts-ignore - 'thinking' is a specific feature of GLM-5.1
      thinking: {
        type: "enabled",
      },
      temperature: 1.0,
      max_tokens: 32768, 
    });

    if (!response.choices[0].message.content) {
      throw new Error("Empty response from Zhipu AI");
    }

    res.json({ text: response.choices[0].message.content });
  } catch (error: any) {
    console.error("Zhipu AI Error:", error);
    const status = error.status || 500;
    const message = error.message || "Internal Server Error";
    res.status(status).json({ 
      error: message, 
      details: error.toString(),
      hint: "Please ensure ZHIPUAI_API_KEY is correctly set."
    });
  }
});

app.post("/api/search-keywords", async (req, res) => {
  try {
    const { query } = req.body;
    const zhipu = getZhipuClient();
    const response = await zhipu.chat.completions.create({
      model: "glm-5-flash", // Use flash version of GLM-5 for quick keywords
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
