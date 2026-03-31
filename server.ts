import express from "express";
import { createServer as createViteServer } from "vite";
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
const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || "sk-f3f8f876b1e447cf9aa38de80f4dd8dd",
  baseURL: "https://api.deepseek.com",
});

// API Routes
app.post("/api/generate", async (req, res) => {
  try {
    const { prompt } = req.body;
    const response = await deepseek.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: "你是一位顶级的小红书/抖音爆款文案专家。" },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
    });

    res.json({ text: response.choices[0].message.content });
  } catch (error: any) {
    console.error("DeepSeek Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/search-keywords", async (req, res) => {
  try {
    const { query } = req.body;
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

// Vite middleware setup
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
