// articleReview.ts — AI 文章质量评估（风格感知·动态维度）
// 根据写作风格动态调整评估维度，不再硬编码 5 维

import { getProvidersSync } from "../storage/providerModels";
import { sendChat } from "./ai";
import { getStyle } from "./writingStyle";

/* ─── 类型 ─── */

export interface ReviewDimension {
  rating: "优" | "良" | "差";
  comment: string;
  suggestion: string;
}

export interface ArticleReview {
  articleId: string;
  reviewedAt: number;
  dimensions: Record<string, ReviewDimension>;
  summary: string;
  modelUsed: string;
  styleId?: string;
}

/** 维度元信息（用于 UI 渲染） */
export interface DimensionMeta {
  id: string;
  label: string;
  description: string;
}

/* ─── 风格→维度映射 ─── */

interface StyleDimensionOverride {
  /** 额外维度 */
  extra?: DimensionMeta[];
  /** 移除的维度 ID */
  remove?: string[];
  /** 提示词补充 */
  promptAddendum?: string;
}

/** 基础 5 维（所有风格共享） */
const BASE_DIMENSIONS: DimensionMeta[] = [
  { id: "opening", label: "开头", description: "文章开头是否有吸引力" },
  { id: "structure", label: "结构逻辑", description: "段落递进是否合理，过渡是否自然" },
  { id: "content", label: "内容质量", description: "信息密度，是否有实质案例支撑" },
  { id: "expression", label: "表达节奏", description: "句式是否多样，段落长短是否有变化" },
  { id: "formatting", label: "格式规范", description: "Markdown 格式是否正确使用" },
];

/** 风格维度覆写表 */
const STYLE_DIMENSION_OVERRIDES: Record<string, StyleDimensionOverride> = {
  academic: {
    extra: [
      { id: "citation", label: "引用规范", description: "引用标注是否完整准确，来源是否可信" },
      { id: "rigor", label: "学术严谨", description: "论证是否严密，有无逻辑漏洞" },
    ],
    promptAddendum: "- **引用规范** — 引用标注是否完整、格式是否统一\n- **学术严谨** — 论证是否严密，避免绝对化表述",
  },
  creative: {
    extra: [
      { id: "narrative", label: "叙事技巧", description: "故事线是否清晰，是否有代入感" },
      { id: "literary", label: "文学表达", description: "语言是否有文学性和感染力" },
    ],
    promptAddendum: "- **叙事技巧** — 故事线是否清晰，有没有制造悬念或情感共鸣\n- **文学表达** — 语言是否有文学性和感染力，避免平铺直叙",
  },
  technical: {
    extra: [
      { id: "code", label: "代码准确", description: "代码示例是否正确，是否可运行" },
      { id: "depth", label: "技术深度", description: "是否深入原理，还是停留在表面" },
    ],
    promptAddendum: "- **代码准确** — 代码示例是否真实、标注语言、可运行\n- **技术深度** — 是否深入原理解释，而非停留在 API 使用层面",
  },
  blog: {
    extra: [
      { id: "readability", label: "可读性", description: "是否易于扫读，小标题/列表是否合理" },
    ],
    promptAddendum: "- **可读性** — 是否适合手机阅读，小标题/列表/加粗是否合理",
  },
  news: {
    extra: [
      { id: "timeliness", label: "时效性", description: "是否提及最新动态，数据是否过时" },
      { id: "objectivity", label: "客观公正", description: "是否平衡呈现多方观点" },
    ],
    promptAddendum: "- **时效性** — 是否提及最新动态，数据是否过时\n- **客观公正** — 是否平衡呈现多方观点，避免偏颇",
  },
};

function getDimensionsForStyle(styleId?: string): { dimensions: DimensionMeta[]; promptAddendum: string } {
  const override = styleId ? STYLE_DIMENSION_OVERRIDES[styleId] : undefined;
  if (!override) {
    return { dimensions: BASE_DIMENSIONS, promptAddendum: "" };
  }

  const filtered = BASE_DIMENSIONS.filter((d) => !override.remove?.includes(d.id));
  const all = [...filtered, ...(override.extra || [])];
  return { dimensions: all, promptAddendum: override.promptAddendum || "" };
}

function buildDimensionPromptLines(dimensions: DimensionMeta[]): string {
  return dimensions
    .map((d, i) => `${i + 1}. **${d.label}** — ${d.description}`)
    .join("\n");
}

function buildDimensionOutputHint(dimensions: DimensionMeta[]): string {
  const lines = dimensions.map((d) => `    "${d.id}": { "rating": "优|良|差", "comment": "简短理由", "suggestion": "具体优化建议" }`);
  return "{\n" + lines.join(",\n") + ',\n  "summary": "总体评价（一句话概括）"\n}';
}

/* ─── 评估函数 ─── */

export async function generateArticleReview(
  articleId: string,
  content: string,
  options?: {
    title?: string;
    description?: string;
    styleId?: string;
  },
): Promise<ArticleReview> {
  const providers = getProvidersSync();
  const provider = providers.find((p) => p.enabled && p.models.length > 0);
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");

  const model = provider.models[0]?.id ?? '';
  const style = options?.styleId ? getStyle(options.styleId) : undefined;
  const { dimensions, promptAddendum } = getDimensionsForStyle(options?.styleId);

  // Style context for system prompt
  let styleContext = "";
  if (style) {
    styleContext = `\n\n## 写作风格参考\n当前文章采用「${style.name}」风格。\n${style.description}\n请在评估时考虑此风格的特点和写作目标。`;
  }

  const dimensionSection = buildDimensionPromptLines(dimensions);
  const outputHint = buildDimensionOutputHint(dimensions);

  const systemPrompt = `你是一位资深编辑，擅长评估中文文章质量。

请从以下维度评估文章，每个维度给出 优/良/差 评级 + 一句简短理由 + 一条具体优化建议。

## 评估维度

${dimensionSection}
${promptAddendum ? "\n" + promptAddendum : ""}

## 要求
- 每个维度的 suggestion 要具体可执行，不能笼统
- 如果 rating 为"优"，suggestion 留空字符串
- 评估时参考文章的写作风格和目标

## 输出格式

严格按照以下 JSON 格式输出，不要额外文字：

${outputHint}${styleContext}`;

  const userPrompt = [
    options?.title ? `## 标题\n${options.title}` : "",
    options?.description ? `## 简介\n${options.description}` : "",
    "",
    "## 正文",
    content.slice(0, 12000),
    "",
    `请从以上 ${dimensions.length} 个维度评估这篇文章。`,
  ].filter(Boolean).join("\n");

  const result = await sendChat({
    providerId: provider.id,
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 2048,
  });

  // 解析 JSON
  const jsonStr = extractJson(result);
  let data: Record<string, any>;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    // Fallback: use generic ratings
    data = {};
  }

  const dims: Record<string, ReviewDimension> = {};
  for (const d of dimensions) {
    dims[d.id] = data[d.id] || { rating: "良" as const, comment: "无法评估", suggestion: "" };
  }

  return {
    articleId,
    reviewedAt: Date.now(),
    dimensions: dims,
    summary: data.summary || "",
    modelUsed: model,
    styleId: options?.styleId,
  };
}

/** 从 AI 回复中提取 JSON 块 */
function extractJson(text: string): string {
  const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeMatch) return codeMatch[1].trim();
  const braceStart = text.indexOf("{");
  const braceEnd = text.lastIndexOf("}");
  if (braceStart >= 0 && braceEnd > braceStart) {
    return text.slice(braceStart, braceEnd + 1);
  }
  return text;
}

/* ─── 存储 ─── */

export async function saveArticleReview(
  articleId: string,
  review: ArticleReview,
): Promise<void> {
  const key = `article_review:${articleId}`;
  try {
    localStorage.setItem(key, JSON.stringify(review));
  } catch { /* ignore */ }
}

export async function loadArticleReview(
  articleId: string,
): Promise<ArticleReview | null> {
  const key = `article_review:${articleId}`;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getReviewLabel(rating: "优" | "良" | "差"): string {
  return rating;
}

export function getReviewColor(rating: "优" | "良" | "差"): string {
  switch (rating) {
    case "优": return "var(--accent, #0969da)";
    case "良": return "var(--warning, #d4920b)";
    case "差": return "var(--danger, #cf222e)";
  }
}

/** 获取某个文章审阅的维度元信息列表 */
export function getDimensionMetas(review: ArticleReview): DimensionMeta[] {
  // Match known dimensions; fall back to generating from keys
  const knownMap = new Map<string, string>();
  for (const d of BASE_DIMENSIONS) knownMap.set(d.id, d.label);
  for (const [_k, overrides] of Object.entries(STYLE_DIMENSION_OVERRIDES)) {
    for (const d of overrides.extra || []) knownMap.set(d.id, d.label);
  }

  return Object.keys(review.dimensions).map((id) => ({
    id,
    label: knownMap.get(id) || id,
    description: "",
  }));
}

/* ─── 优化函数 ─── */

export async function applyOptimization(
  articleId: string,
  content: string,
  review: ArticleReview,
  options?: {
    title?: string;
  },
): Promise<string> {
  const providers = getProvidersSync();
  const provider = providers.find((p) => p.enabled && p.models.length > 0);
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");

  // 收集有建议的维度（适配动态维度）
  const dimensionLabels = getDimensionMetas(review);
  const suggestions = dimensionLabels
    .filter((meta) => {
      const d = review.dimensions[meta.id];
      return d && d.suggestion;
    })
    .map((meta) => {
      const d = review.dimensions[meta.id]!;
      return `- ${meta.label}（当前评级：${d.rating}）: ${d.suggestion}`;
    });

  const model = provider.models[0]?.id ?? '';

  const sysPrompt = `你是一位资深写作者，根据编辑的优化建议重写文章。

## 原则
- 保留原文的核心观点、事实和案例，不编造新内容
- 只改进编辑指出的问题，不改变文章主旨和结构框架
- 如果编辑建议涉及删减，果断删除冗余内容
- 保持原文的技术准确性和专业度
- 直接输出完整的重写后文章（Markdown 格式），不要额外说明`;

  const userPrompt = [
    options?.title ? `## 标题\n${options.title}` : "",
    "## 优化建议",
    ...suggestions,
    "",
    "## 原文",
    content.slice(0, 12000),
    "",
    "请根据以上优化建议重写文章，直接输出完整的 Markdown 内容。",
  ].join("\n");

  const result = await sendChat({
    providerId: provider.id,
    model,
    messages: [
      { role: "system", content: sysPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.5,
    maxTokens: 8192,
  });

  return result.trim();
}
