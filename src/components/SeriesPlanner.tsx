import { useState, useCallback, useRef, useEffect } from "react";
import { Sparkles, BookOpen, ArrowRight, Check, Loader2, X, Plus, Trash2, GripVertical, AlertCircle, FileText } from "lucide-react";
import type { SeriesPlan, SeriesArticle, ProjectContext } from "../lib/collections";
import { buildContextText, formatContextText } from "../lib/projectContext";
import { sendChat, type ChatMessage } from "../lib/ai";
import { getProvidersSync } from "../lib/providerModels";

/* ─── 类型 ─── */

type PlannerStep = "input" | "generating" | "review" | "done";

interface SeriesPlannerProps {
  open: boolean;
  collectionId: string;
  collectionTitle: string;
  linkedFolder?: string;
  existingPlan?: SeriesPlan | null;
  onSave: (plan: SeriesPlan) => void;
  onClose: () => void;
}

/* ─── 默认文章数 ─── */

const DEFAULT_ARTICLE_COUNT = 5;

/* ─── AI 辅助 ─── */

function getProvider() {
  const providers = getProvidersSync();
  return providers.find((p) => p.enabled && p.models.length > 0) || null;
}

async function askAI(systemPrompt: string, userPrompt: string, maxTokens = 4096): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
  return await sendChat({
    providerId: provider.id,
    model: provider.models[0],
    messages,
    temperature: 0.7,
    maxTokens,
  });
}

/* ─── 组件 ─── */

export function SeriesPlanner({
  open,
  collectionId,
  collectionTitle,
  linkedFolder = "",
  existingPlan,
  onSave,
  onClose,
}: SeriesPlannerProps) {
  const [step, setStep] = useState<PlannerStep>("input");
  const [direction, setDirection] = useState("");
  const [articleCount, setArticleCount] = useState(DEFAULT_ARTICLE_COUNT);
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [customAudience, setCustomAudience] = useState("");
  const [articles, setArticles] = useState<SeriesArticle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [projectCtx, setProjectCtx] = useState<ProjectContext | null>(null);
  const [ctxText, setCtxText] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState("AI 正在分析项目结构…");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load project context on open
  useEffect(() => {
    if (!open) return;
    
    if (existingPlan) {
      // Edit existing plan: skip to review step
      setArticles(existingPlan.articles.map(a => ({ ...a, status: "planned" as const })));
      setDirection(existingPlan.title || "");
      setTone(existingPlan.tone || "");
      setAudience(existingPlan.targetAudience || "");
      setCustomAudience("");
      setArticleCount(existingPlan.articles.length);
      setError(null);
      setGenerating(false);
      setStep("review");
      setProjectCtx(null);
      setCtxText("");
    } else {
      // New plan: start from input step
      setStep("input");
      setDirection("");
      setArticleCount(DEFAULT_ARTICLE_COUNT);
      setTone("");
      setAudience("");
      setCustomAudience("");
      setArticles([]);
      setError(null);
      setGenerating(false);
      setProjectCtx(null);
      setCtxText("");
    }

    if (linkedFolder) {
      import("../lib/collections").then(({ getProjectContext }) => {
        getProjectContext(linkedFolder).then((ctx) => {
          setProjectCtx(ctx);
          setCtxText(formatContextText(ctx));
        }).catch(() => {});
      });
    }
  }, [open, linkedFolder]);

  // Rotating status messages during generation
  useEffect(() => {
    if (step !== "generating") return;
    const messages = [
      "AI 正在分析项目结构…",
      "识别核心模块和架构…",
      "梳理技术栈和依赖关系…",
      "制定文章递进顺序…",
      "平衡各篇内容的深度…",
      "生成系列文章规划…",
    ];
    let i = 0;
    setGenStatus(messages[0]);
    const timer = setInterval(() => {
      i = (i + 1) % messages.length;
      setGenStatus(messages[i]);
    }, 3000);
    return () => clearInterval(timer);
  }, [step]);

  // Focus input on open
  useEffect(() => {
    if (open && step === "input") {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, step]);

  /* 预设方向 */
  const PRESETS = [
    { label: "项目架构总览", description: "覆盖项目的整体架构、技术选型和设计理念" },
    { label: "核心模块详解", description: "深入分析项目的主要模块和核心功能" },
    { label: "从零搭建", description: "手把手教程，从环境准备到实现完整功能" },
    { label: "最佳实践", description: "项目中使用的最佳实践、设计模式和代码规范" },
    { label: "API 文档", description: "完整的 API 接口文档和使用示例" },
  ];

  // Apply preset
  const handlePreset = useCallback((preset: typeof PRESETS[0]) => {
    const lang = projectCtx?.primaryLanguage || "";
    const name = projectCtx?.name || "";
    setDirection(`写 ${articleCount} 篇关于 ${name}${lang ? ` (${lang})` : ""} 的文章，覆盖：${preset.description}。面向开发者读者，语言通俗易懂，每篇有代码示例。`);
  }, [projectCtx, articleCount]);

  /* 生成系列规划 */
  const handleGenerate = useCallback(async () => {
    if (!direction.trim() || !ctxText) return;

    setGenerating(true);
    setError(null);
    setStep("generating");

    try {
      const sysPrompt = `你是一位技术写作策划专家。根据用户的项目上下文和写作方向，规划一个系列文章的完整目录。

## 输出格式
严格按照下面的 JSON 格式输出，不要包含 \`\`\`json 标记：
{
  "articles": [
    {
      "title": "文章标题",
      "description": "一句话简介，30-80字",
      "targetWordCount": 800
    }
  ]
}

## 要求
- 生成 ${articleCount} 篇文章
- 每篇文章标题要准确反映内容
- 文章之间要有逻辑递进关系
- 覆盖从入门到深入的不同层次
- 总字数分布合理，重要模块篇幅更长
- 直接输出 JSON，不要任何额外文字`;

      // Build style info
      const styleInfo = [tone && `写作风格: ${tone}`, audience && `目标读者: ${audience === "__custom__" ? customAudience : audience}`].filter(Boolean).join("，");

      const userPrompt = [
        `## 项目信息\n项目名称: ${projectCtx?.name || collectionTitle}\n主要语言: ${projectCtx?.primaryLanguage || "未知"}\n文件数: ${projectCtx?.summary.totalFiles || 0} 文件`,
        styleInfo ? `\n## 风格要求\n${styleInfo}` : "",
        ``,
        `## 项目上下文（关键信息）`,
        ctxText.slice(0, 6000),
        ``,
        `## 写作方向`,
        direction,
        ``,
        `请生成 ${articleCount} 篇文章的规划，严格按 JSON 格式输出。`,
      ].join("\n");

      const result = await askAI(sysPrompt, userPrompt, 4096);
      
      // Parse JSON from response
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("AI 返回格式异常，请重试");
      
      const parsed = JSON.parse(jsonMatch[0]);
      if (!parsed.articles || !Array.isArray(parsed.articles) || parsed.articles.length === 0) {
        throw new Error("AI 未生成有效文章列表，请重试");
      }

      const genArticles: SeriesArticle[] = parsed.articles.map((a: any, i: number) => ({
        id: `series_art_${Date.now()}_${i}`,
        title: a.title || `文章 ${i + 1}`,
        description: a.description || "",
        targetWordCount: a.targetWordCount || 800,
        status: "planned" as const,
      }));

      setArticles(genArticles);
      setStep("review");
    } catch (e: any) {
      setError(e?.message || "生成失败");
      setStep("input");
    } finally {
      setGenerating(false);
    }
  }, [direction, articleCount, ctxText, projectCtx, collectionTitle]);

  /* 编辑文章列表 */
  const handleRemove = useCallback((index: number) => {
    setArticles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setArticles((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setArticles((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleEditTitle = useCallback((index: number, title: string) => {
    setArticles((prev) => prev.map((a, i) => i === index ? { ...a, title } : a));
  }, []);

  const handleEditDesc = useCallback((index: number, description: string) => {
    setArticles((prev) => prev.map((a, i) => i === index ? { ...a, description } : a));
  }, []);

  const handleAddArticle = useCallback(() => {
    setArticles((prev) => [
      ...prev,
      { id: `series_art_${Date.now()}_${prev.length}`, title: "新文章", description: "", targetWordCount: 800, status: "planned" },
    ]);
  }, []);

  /* 确认保存 */
  const handleConfirm = useCallback(async () => {
    const audienceVal = audience === "__custom__" ? customAudience.trim() : audience;
    const planTitle = direction.trim() || collectionTitle || "系列文章";
    const plan: SeriesPlan = {
      id: `series_${collectionId}`,
      title: planTitle,
      createdAt: Date.now(),
      tone: tone || undefined,
      targetAudience: audienceVal || undefined,
      articles: articles.filter((a) => a.title.trim()),
    };
    if (plan.articles.length === 0) return;
    await onSave(plan);
    setStep("done");
  }, [articles, collectionId, direction, collectionTitle, tone, audience, customAudience, onSave]);

  /* 重新生成 */
  const handleRegenerate = useCallback(() => {
    setStep("input");
    setArticles([]);
    setError(null);
  }, []);

  if (!open) return null;

  return (
    <div className="series-planner-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="series-planner" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="series-planner__header">
          <BookOpen size={16} />
          <span>规划系列文章 · {collectionTitle}</span>
          {projectCtx && (
            <span className="series-planner__project-tag">
              {projectCtx.summary.totalFiles} 文件 · {projectCtx.primaryLanguage || ""}
            </span>
          )}
          <button className="series-planner__close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="series-planner__body">
          {/* Step 1: Input direction */}
          {step === "input" && (
            <>
              <div className="series-planner__desc">
                描述你想写的系列方向，AI 会根据项目上下文自动生成文章规划。
              </div>

              {/* Presets */}
              <div className="series-planner__presets">
                {PRESETS.map((p) => (
                  <button key={p.label} className="series-planner__preset-btn" onClick={() => handlePreset(p)}>
                    <Sparkles size={10} />
                    {p.label}
                  </button>
                ))}
              </div>

              <textarea
                ref={inputRef}
                className="series-planner__input"
                placeholder="例如：写一个面向初学者的项目教程，从架构到部署，覆盖核心功能和最佳实践…"
                rows={4}
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
              />

              <div className="series-planner__options">
                <span className="series-planner__count-label">文章数量:</span>
                <input
                  type="number"
                  className="series-planner__count-input"
                  min={2}
                  max={20}
                  value={articleCount}
                  onChange={(e) => setArticleCount(Math.max(2, Math.min(20, parseInt(e.target.value) || 5)))}
                />
                <select className="series-planner__option-select" value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="">写作风格</option>
                  {["文艺","正式","口语","学术","幽默"].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <select className="series-planner__option-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="">目标读者</option>
                  {["不限","大众读者","技术人员","文学爱好者","学生","__custom__"].map(o => (
                    <option key={o} value={o}>{o === "__custom__" ? "自定义…" : o}</option>
                  ))}
                </select>
                {audience === "__custom__" && (
                  <input className="series-planner__option-input" placeholder="输入读者" value={customAudience}
                    onChange={(e) => setCustomAudience(e.target.value)} />
                )}
              </div>

              {error && (
                <div className="series-planner__error">
                  <AlertCircle size={12} />
                  <span>{error}</span>
                </div>
              )}

              <div className="series-planner__actions">
                <button className="btn btn--primary" disabled={!direction.trim() || generating} onClick={handleGenerate}>
                  {generating ? <><Loader2 size={14} className="series-planner__spinner" /> 生成中…</> : <><Sparkles size={14} /> 生成规划</>}
                </button>
              </div>
            </>
          )}

          {/* Step 2: Generating */}
          {step === "generating" && (
            <div className="series-planner__generating">
              <Loader2 size={28} className="series-planner__spinner" />
              <div className="series-planner__gen-status">
                <div className="series-planner__gen-dots">
                  <span className="series-planner__gen-dot" />
                  <span className="series-planner__gen-dot" />
                  <span className="series-planner__gen-dot" />
                </div>
                <p className="series-planner__gen-text">{genStatus}</p>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === "review" && (
            <>
              <div className="series-planner__desc">
                审阅 AI 生成的系列规划。你可以调整顺序、修改标题和描述。
              </div>

              <div className="series-planner__article-list">
                {articles.map((article, i) => (
                  <div key={article.id} className="series-planner__article-card">
                    <div className="series-planner__article-order">
                      <span className="series-planner__article-num">{i + 1}</span>
                      <div className="series-planner__article-move">
                        <button disabled={i === 0} onClick={() => handleMoveUp(i)} title="上移">↑</button>
                        <button disabled={i >= articles.length - 1} onClick={() => handleMoveDown(i)} title="下移">↓</button>
                      </div>
                    </div>
                    <div className="series-planner__article-body">
                      <input
                        className="series-planner__article-title"
                        value={article.title}
                        onChange={(e) => handleEditTitle(i, e.target.value)}
                        placeholder="文章标题"
                      />
                      <input
                        className="series-planner__article-desc"
                        value={article.description}
                        onChange={(e) => handleEditDesc(i, e.target.value)}
                        placeholder="文章简介"
                      />
                      <div className="series-planner__article-meta">
                        <span>~{article.targetWordCount || 800} 字</span>
                      </div>
                    </div>
                    <button className="series-planner__article-remove" onClick={() => handleRemove(i)} title="删除">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>

              <button className="series-planner__add-btn" onClick={handleAddArticle}>
                <Plus size={12} /> 添加文章
              </button>

              <div className="series-planner__actions">
                <button className="btn" onClick={handleRegenerate}>
                  重新生成
                </button>
                <button className="btn btn--primary" onClick={handleConfirm} disabled={articles.filter(a => a.title.trim()).length === 0}>
                  <Check size={14} /> 确认并保存
                </button>
              </div>
            </>
          )}

          {/* Step 4: Done */}
          {step === "done" && (
            <div className="series-planner__done">
              <Check size={24} className="series-planner__done-icon" />
              <p>系列规划已保存！共 {articles.filter(a => a.title.trim()).length} 篇文章。</p>
              <div className="series-planner__done-list">
                {articles.filter(a => a.title.trim()).map((a, i) => (
                  <div key={a.id} className="series-planner__done-item">
                    <FileText size={12} />
                    <span>{i + 1}. {a.title}</span>
                    <span className="series-planner__done-desc">{a.description}</span>
                  </div>
                ))}
              </div>
              <button className="btn btn--primary" onClick={onClose}>
                <Check size={14} /> 完成
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SeriesPlanner;
