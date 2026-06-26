// articleReview.ts — AI 文章质量评估
// 一次性将文章内容发送给 AI 进行多维度评估

import { getProvidersSync } from "../storage/providerModels";
import { sendChat } from "./ai";

/* ─── 类型 ─── */

export interface ReviewDimension {
  rating: "优" | "良" | "差";
  comment: string;
  suggestion: string;
}

export interface ArticleReview {
  articleId: string;
  reviewedAt: number;
  dimensions: {
    opening: ReviewDimension;
    structure: ReviewDimension;
    content: ReviewDimension;
    expression: ReviewDimension;
    formatting: ReviewDimension;
  };
  summary: string;
  modelUsed: string;
}

/* ─── Prompt ─── */

const REVIEW_SYSTEM_PROMPT = `你是一位资深编辑，擅长评估中文文章质量。

请从以下五个维度评估文章，每个维度给出 优/良/差 评级 + 一句简短理由 + 一条具体优化建议。

## 评估维度

1. **开头** — 文章开头是否有吸引力（场景/故事/问题/数据/反常识），还是公式化的「本文介绍了…」
2. **结构逻辑** — 段落递进是否合理，过渡是否自然，整体框架是否清晰连贯
3. **内容质量** — 信息密度，是否有实质案例/数据/代码支撑，有无空洞套话或泛泛而谈
4. **表达节奏** — 句式是否多样，段落长短是否有变化，语言生动还是刻板
5. **格式规范** — Markdown 格式（标题层级、代码块标注语言、加粗引用等）是否正确使用

## 要求
- 每个维度的 suggestion 要具体可执行，不能笼统（比如"增加案例"太模糊，应该说"在消息持久化部分补充一段 RocksDB 写入流程的代码示例"）
- 如果 rating 为"优"，suggestion 留空字符串

## 输出格式

严格按照以下 JSON 格式输出，不要额外文字：

{
  "opening": { "rating": "优|良|差", "comment": "简短理由", "suggestion": "具体优化建议" },
  "structure": { "rating": "优|良|差", "comment": "简短理由", "suggestion": "具体优化建议" },
  "content": { "rating": "优|良|差", "comment": "简短理由", "suggestion": "具体优化建议" },
  "expression": { "rating": "优|良|差", "comment": "简短理由", "suggestion": "具体优化建议" },
  "formatting": { "rating": "优|良|差", "comment": "简短理由", "suggestion": "具体优化建议" },
  "summary": "总体评价（一句话概括）"
}`;

/* ─── 评估函数 ─── */

export async function generateArticleReview(
  articleId: string,
  content: string,
  options?: {
    title?: string;
    description?: string;
  },
): Promise<ArticleReview> {
  const providers = getProvidersSync();
  const provider = providers.find((p) => p.enabled && p.models.length > 0);
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");

  const model = provider.models[0];

  const userPrompt = [
    options?.title ? `## 标题
${options.title}` : "",
    options?.description ? `## 简介
${options.description}` : "",
    "",
    "## 正文",
    content.slice(0, 12000), // 限制输入长度
    "",
    "请从以上五个维度评估这篇文章。",
  ].filter(Boolean).join("\n");

  const result = await sendChat({
    providerId: provider.id,
    model,
    messages: [
      { role: "system", content: REVIEW_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    maxTokens: 2048,
  });

  // 解析 JSON
  const jsonStr = extractJson(result);
  const data = JSON.parse(jsonStr);

  return {
    articleId,
    reviewedAt: Date.now(),
    dimensions: {
      opening: data.opening || { rating: "良", comment: "无法评估", suggestion: "" },
      structure: data.structure || { rating: "良", comment: "无法评估", suggestion: "" },
      content: data.content || { rating: "良", comment: "无法评估", suggestion: "" },
      expression: data.expression || { rating: "良", comment: "无法评估", suggestion: "" },
      formatting: data.formatting || { rating: "良", comment: "无法评估", suggestion: "" },
    },
    summary: data.summary || "",
    modelUsed: model,
  };
}

/** 从 AI 回复中提取 JSON 块 */
function extractJson(text: string): string {
  // 尝试 ```json ... ``` 包裹
  const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeMatch) return codeMatch[1].trim();
  // 尝试直接解析
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

  // 收集有建议的维度
  const suggestions = Object.entries(review.dimensions)
    .filter(([_, d]) => d.suggestion)
    .map(([key, d]) => {
      const labels: Record<string, string> = {
        opening: "开头", structure: "结构逻辑", content: "内容质量",
        expression: "表达节奏", formatting: "格式规范",
      };
      return `- ${labels[key] || key}（当前评级：${d.rating}）: ${d.suggestion}`;
    });

  const model = provider.models[0];

  const sysPrompt = `你是一位资深写作者，根据编辑的优化建议重写文章。

## 原则
- 保留原文的核心观点、事实和案例，不编造新内容
- 只改进编辑指出的问题，不改变文章主旨和结构框架
- 如果编辑建议涉及删减，果断删除冗余内容
- 保持原文的技术准确性和专业度
- 直接输出完整的重写后文章（Markdown 格式），不要额外说明`;

  const userPrompt = [
    options?.title ? `## 标题
${options.title}` : "",
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
