/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  FileText, 
  Copy, 
  Check, 
  RefreshCw, 
  TrendingUp, 
  History as HistoryIcon,
  Loader2,
  ChevronRight,
  Info,
  Image as ImageIcon,
  Type,
  PenTool,
  ArrowRight,
  Download,
  Zap,
  Trash2,
  X,
  ExternalLink,
  Settings2,
  Layout
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { cn } from "./lib/utils";

// --- Types ---
interface GenerationResult {
  id: string;
  title: string;
  articles: string[]; // Store 4 versions
  timestamp: number;
  type: "generate" | "rewrite";
}

const STYLES = ["小红书爆款", "知乎深度", "微博热议", "朋友圈文学", "专业测评", "幽默风趣"];
const LENGTHS = ["短小精悍 (200字)", "中等篇幅 (500字)", "长篇大论 (1000字)"];

// --- App Component ---
export default function App() {
  const [mode, setMode] = useState<"generate" | "rewrite">("generate");
  const [title, setTitle] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [referenceMaterials, setReferenceMaterials] = useState("");
  const [isFetchingRef, setIsFetchingRef] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [history, setHistory] = useState<GenerationResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [refiningIndex, setRefiningIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Refinement states
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [selectedLength, setSelectedLength] = useState(LENGTHS[1]);

  // Handlers
  const callDeepSeek = async (prompt: string) => {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!response.ok) throw new Error("API call failed");
    const data = await response.json();
    return data.text;
  };

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("trendweaver_history_v3");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    localStorage.setItem("trendweaver_history_v3", JSON.stringify(history));
  }, [history]);

  // --- Handlers ---

  const fetchHardcoreInfo = async () => {
    const query = mode === "generate" ? title : sourceText.slice(0, 50);
    if (!query.trim()) {
      setError(mode === "generate" ? "请先输入标题或主题" : "请先输入原文内容");
      return;
    }

    setIsFetchingRef(true);
    setError(null);

    try {
      const text = await callDeepSeek(`针对主题/内容“${query}”，请搜索并提供以下“硬核信息”：
1. 该应用/产品的最新更新日志（如果有）。
2. 用户的高频评价或吐槽点。
3. 当前在微博、小红书上的相关热点词或流行语。

要求：
- 以纯文本列表形式返回。
- 严禁使用星号(*)或井号(#)进行排版。
- 保持内容精炼、真实。`);

      if (text) {
        const cleanedText = text.replace(/[*#]/g, '').trim();
        setReferenceMaterials(prev => prev ? `${prev}\n\n实时动态：\n${cleanedText}` : cleanedText);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setError("抓取硬核信息失败，请重试。");
    } finally {
      setIsFetchingRef(false);
    }
  };

  const generateContent = async (isRefinement = false) => {
    const input = mode === "generate" ? title : sourceText;
    if (!input.trim()) {
      setError(mode === "generate" ? "请先输入标题或主题" : "请先输入原文内容");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const basePrompt = mode === "generate" 
        ? `针对标题“${title}”，创作4篇不同侧重点的爆款推文。`
        : `将以下原文改写为4篇不同风格的爆款推文：\n${sourceText}`;

      const prompt = `${basePrompt}

要求：
1. 风格多样化：包括但不限于“干货分享型”、“情感共鸣型”、“悬念反转型”、“利益诱导型”。
2. 结构清晰：每篇文案必须包含一个极其吸睛的标题，标题必须加粗（使用Markdown语法，如 **标题内容**），正文逻辑分明，并配有相关的Emoji。
3. 严禁事项：严禁在正文中使用星号(*)或井号(#)作为纯装饰。保持排版清爽。
4. 目标：每一篇都要具备极高的点击率和转化潜力。
5. 格式：直接返回4篇文章，每篇之间用 "---ARTICLE_SPLIT---" 分隔。`;

      const text = await callDeepSeek(prompt);

      if (text) {
        const articles = text.split("---ARTICLE_SPLIT---").map(a => a.trim()).filter(a => a.length > 0).slice(0, 4);
        
        // Ensure we have 4 if possible
        while (articles.length < 4 && articles.length > 0) {
          articles.push(articles[0]);
        }

        const newResult: GenerationResult = {
          id: Date.now().toString(),
          title: mode === "generate" ? title : sourceText.slice(0, 20) + "...",
          articles: articles,
          timestamp: Date.now(),
          type: mode
        };
        setResult(newResult);
        setHistory(prev => [newResult, ...prev].slice(0, 20));
      }
    } catch (err) {
      console.error("Generation error:", err);
      setError("生成内容失败，请检查网络或重试。");
    } finally {
      setIsGenerating(false);
    }
  };

  const refineSingleArticle = async (index: number) => {
    if (!result) return;
    const currentArticle = result.articles[index];
    
    setRefiningIndex(index);
    setError(null);

    try {
      const prompt = `请对以下文章进行精准改写：
文章内容：${currentArticle}

要求：
1. 风格：${selectedStyle}
2. 篇幅：${selectedLength}
3. 格式：标题必须加粗（使用Markdown语法，如 **标题内容**），并直接返回改写后的全文。
4. 严禁事项：严禁在正文中使用星号(*)或井号(#)作为纯装饰。保持排版清爽。
5. 目标：在保留核心信息的基础上，完全按照“${selectedStyle}”的风格和“${selectedLength}”的篇幅进行重塑。`;

      const text = await callDeepSeek(prompt);

      if (text) {
        const cleanedText = text.replace(/[*#]/g, '').trim();
        const newArticles = [...result.articles];
        newArticles[index] = cleanedText;
        const updatedResult = { ...result, articles: newArticles };
        setResult(updatedResult);
        // Update history too
        setHistory(prev => prev.map(h => h.id === result.id ? updatedResult : h));
      }
    } catch (err) {
      console.error("Refine error:", err);
      setError("精修失败，请重试。");
    } finally {
      setRefiningIndex(null);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(h => h.id !== id));
  };

  const openImageSearch = async (site: string) => {
    const queryBase = title || sourceText.slice(0, 20) || "爆款推文";
    
    // Generate minimal keywords for better search results
    let keywords = queryBase;
    try {
      const response = await fetch("/api/search-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryBase }),
      });
      if (response.ok) {
        const data = await response.json();
        keywords = data.text.trim();
      }
    } catch (e) {
      console.error("Keyword gen failed", e);
    }

    const query = encodeURIComponent(keywords);
    let url = "";
    if (site === "freepik") url = `https://www.freepik.com/search?query=${query}`;
    if (site === "pixabay") url = `https://pixabay.com/images/search/${query}/`;
    if (site === "pexels") url = `https://www.pexels.com/search/${query}/`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100 selection:text-indigo-700">
      {/* Header - Indigo Theme */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <Sparkles size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">爆款推文生成器</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">TrendWeaver AI Engine</p>
          </div>
        </div>
        <nav className="flex gap-6 items-center">
          <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
            <button 
              onClick={() => setMode("generate")} 
              className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", mode === "generate" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              内容创作
            </button>
            <button 
              onClick={() => setMode("rewrite")} 
              className={cn("px-4 py-1.5 text-xs font-bold rounded-md transition-all", mode === "rewrite" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              文章改写
            </button>
          </div>
          <button onClick={() => setShowHistory(true)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors">
            <HistoryIcon size={20} />
          </button>
        </nav>
      </header>

      <main className="pt-24 pb-12 max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left Column: Input & Results (8 cols) */}
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-indigo-600">
                <FileText size={18} />
                <h2 className="text-sm font-bold uppercase tracking-wider">核心输入</h2>
              </div>
              
              <AnimatePresence mode="wait">
                {mode === "generate" ? (
                  <motion.div key="generate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="输入一个吸睛的标题或主题..."
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-lg font-medium focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-300"
                    />
                  </motion.div>
                ) : (
                  <motion.div key="rewrite" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                    <textarea
                      value={sourceText}
                      onChange={(e) => setSourceText(e.target.value)}
                      placeholder="粘贴需要改写的文案素材..."
                      className="w-full h-40 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-base focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none placeholder:text-slate-300"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-600">
                  <TrendingUp size={18} />
                  <h2 className="text-sm font-bold uppercase tracking-wider">实时参考资料</h2>
                </div>
                <button
                  onClick={fetchHardcoreInfo}
                  disabled={isFetchingRef}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors disabled:opacity-30"
                >
                  {isFetchingRef ? <Loader2 className="animate-spin" size={12} /> : <RefreshCw size={12} />}
                  抓取最新动态
                </button>
              </div>
              <textarea
                value={referenceMaterials}
                onChange={(e) => setReferenceMaterials(e.target.value)}
                placeholder="自动抓取或手动输入更新日志、热点词..."
                className="w-full h-48 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none placeholder:text-slate-300"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">默认文风</label>
                <div className="relative">
                  <select 
                    value={selectedStyle}
                    onChange={(e) => setSelectedStyle(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all"
                  >
                    {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">默认篇幅</label>
                <div className="relative">
                  <select 
                    value={selectedLength}
                    onChange={(e) => setSelectedLength(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none appearance-none transition-all"
                  >
                    {LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <ChevronRight size={14} className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <button
              onClick={() => generateContent()}
              disabled={isGenerating}
              className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} />}
              {isGenerating ? "正在编织内容..." : "生成4篇爆款文案"}
            </button>
            {error && <p className="text-red-500 text-[10px] text-center font-bold uppercase">{error}</p>}
          </section>

          {/* Result Section - Moved here below Input */}
          <AnimatePresence mode="wait">
            {result && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <Layout size={18} />
                    <h2 className="text-sm font-bold uppercase tracking-wider">生成成果 (4个版本)</h2>
                  </div>
                  <button onClick={() => generateContent(true)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" title="重新生成全部">
                    <RefreshCw size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {result.articles.map((article, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, y: 20 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      transition={{ delay: idx * 0.1 }}
                      className="group bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex flex-col min-h-[400px] relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md uppercase tracking-wider">Version {idx + 1}</span>
                          <span className="text-[10px] text-slate-400 font-medium">{article.length} 字</span>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            onClick={() => copyToClipboard(article, idx)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                            title="复制内容"
                          >
                            {copiedIndex === idx ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 text-sm leading-relaxed prose prose-slate max-w-none selection:bg-indigo-50 mb-6">
                        <ReactMarkdown>{article}</ReactMarkdown>
                      </div>

                      {/* Per-Article Refinement UI */}
                      <div className="mt-auto pt-6 border-t border-slate-50 space-y-4">
                        <div className="flex items-center gap-2 text-indigo-600 mb-2">
                          <Settings2 size={14} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">精准精修 / 风格重塑</span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <select 
                            value={selectedStyle}
                            onChange={(e) => setSelectedStyle(e.target.value)}
                            className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          >
                            {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <select 
                            value={selectedLength}
                            onChange={(e) => setSelectedLength(e.target.value)}
                            className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-600 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          >
                            {LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>

                        <button 
                          onClick={() => refineSingleArticle(idx)}
                          disabled={refiningIndex !== null || isGenerating}
                          className="w-full py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-[10px] hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {refiningIndex === idx ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                          {refiningIndex === idx ? "重塑中..." : "重塑此篇文案"}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Tools & Info (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Image Search Section - Moved here */}
          <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
            <div className="flex items-center gap-3 text-indigo-600">
              <ImageIcon size={24} />
              <h2 className="text-lg font-bold uppercase tracking-wider">极简插图检索</h2>
            </div>
            <p className="text-sm text-slate-400">根据当前创作主题，为您在顶级图库中一键检索高质量配图素材。</p>
            <div className="grid grid-cols-3 gap-6">
              <button onClick={() => openImageSearch("freepik")} className="flex flex-col items-center gap-4 p-6 border border-slate-100 rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 transition-all group">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform font-black text-xl">F</div>
                <div className="text-center">
                  <span className="block text-xs font-bold">Freepik</span>
                  <span className="text-[10px] text-slate-400">矢量/照片</span>
                </div>
              </button>
              <button onClick={() => openImageSearch("pixabay")} className="flex flex-col items-center gap-4 p-6 border border-slate-100 rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 transition-all group">
                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform font-black text-xl">P</div>
                <div className="text-center">
                  <span className="block text-xs font-bold">Pixabay</span>
                  <span className="text-[10px] text-slate-400">免费商用</span>
                </div>
              </button>
              <button onClick={() => openImageSearch("pexels")} className="flex flex-col items-center gap-4 p-6 border border-slate-100 rounded-2xl hover:bg-indigo-50 hover:border-indigo-200 transition-all group">
                <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform font-black text-xl">X</div>
                <div className="text-center">
                  <span className="block text-xs font-bold">Pexels</span>
                  <span className="text-[10px] text-slate-400">高清摄影</span>
                </div>
              </button>
            </div>
          </section>

          {!result && (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center text-center p-12 bg-white rounded-2xl border border-dashed border-slate-200 opacity-40">
              <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                <Sparkles size={48} className="text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold mb-2">等待生成指令</h3>
              <p className="text-sm max-w-sm">在左侧输入您的创意主题，我们将为您编织出4个不同维度的爆款内容。</p>
            </div>
          )}
        </div>
      </main>

      {/* History Drawer */}
      <AnimatePresence>
        {showHistory && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowHistory(false)} className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-[70] p-8 flex flex-col gap-8 shadow-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">历史创作</h2>
                <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4">
                {history.length === 0 ? (
                  <div className="py-20 text-center opacity-20">暂无记录</div>
                ) : (
                  history.map((item) => (
                    <div key={item.id} className="group p-4 border border-slate-100 rounded-xl hover:border-indigo-600 transition-all cursor-pointer relative" onClick={() => { setResult(item); setShowHistory(false); }}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">{item.type === "generate" ? "创作" : "改写"}</span>
                        <span className="text-[10px] text-slate-400">{new Date(item.timestamp).toLocaleDateString()}</span>
                      </div>
                      <h3 className="text-sm font-bold truncate">{item.title}</h3>
                      <button onClick={(e) => { e.stopPropagation(); deleteHistoryItem(item.id); }} className="absolute top-2 right-2 p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}} />
    </div>
  );
}
