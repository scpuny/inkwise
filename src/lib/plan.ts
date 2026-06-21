// plan.ts — 分步 AI 文章规划
// 不依赖 JSON 输出，每一步返回纯文本，逐层推进

import { sendChat, type ChatMessage } from "./ai";
import { getProvidersSync } from "./providerModels";
import type { OutlineSection } from "./articleBlueprint";

/* ─── 逐步生成的结果类型 ─── */
export interface PartialPlan {
  title: string;
  description: string;
  outline: OutlineSection[];
  tags: string[];
  tone: string;
  targetAudience: string;
  targetWordCount: number;
}


export interface PlanInput {
  inspiration: string;
  tone?: string;
  targetAudience?: string;
  targetWordCount?: number;
}

/* ─── 分步生成器 ───
   每一步都只让 AI 输出一小段纯文本，前端解析。
   不依赖 JSON 格式，大大降低解析失败率。
*/

let _stepId = 0;

/** 获取可用的 provider */
function getProvider() {
  const providers = getProvidersSync();
  return providers.find((p) => p.enabled && p.models.length > 0) || null;
}

/** 通用单步 AI 请求 */
async function askAI(systemPrompt: string, userPrompt: string, maxTokens = 1024): Promise<string> {
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

/* ─── Step 1: 标题 ─── */

export async function generateTitle(input: PlanInput): Promise<string> {
  const sysPrompt = `你是一位标题创作专家。根据用户的灵感和偏好，生成一个吸引人的文章标题。

## 规则
- 标题要准确反映内容
- 控制在 8-25 字
- 直接输出标题，不要有任何前缀、引号或额外文字
- 只输出一行，不要换行`;

  const userPrompt = [
    `灵感: ${input.inspiration}`,
    input.tone ? `风格: ${input.tone}` : "",
    input.targetAudience ? `目标读者: ${input.targetAudience}` : "",
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt);
  return result.trim().replace(/^[""''""]|[""''""]$/g, "").trim();
}

/* ─── Step 2: 简介 ─── */

export async function generateDescription(input: PlanInput, title: string): Promise<string> {
  const sysPrompt = `你是一位专业的文章策划。根据文章的标题和灵感，写一句简洁有力的文章简介。

## 规则
- 一句话概括文章要表达的核心内容
- 30-80 字
- 直接输出简介，不要前缀和引号
- 只输出一行`;

  const userPrompt = [
    `灵感: ${input.inspiration}`,
    `标题: ${title}`,
    input.tone ? `风格: ${input.tone}` : "",
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt);
  return result.trim().replace(/^[""''""]|[""''""]$/g, "").trim();
}

/* ─── Step 3: 大纲 ─── */

export async function generateOutline(input: PlanInput, title: string, description: string): Promise<OutlineSection[]> {
  const sysPrompt = `你是一位写作规划师。为文章生成大纲结构。

## 输出格式
输出一个编号列表，每行一个章节。格式为：
1. 章节标题 - 章节描述
2. 章节标题 - 章节描述

- 如果章节有子章节，子章节缩进 2 个空格：
  1. 主章节
    1.1 子章节 - 子章节描述
    1.2 子章节 - 子章节描述
  2. 主章节

## 规则
- 3-6 个主章节
- 章节标题简洁明了
- 章节描述（可选）说明这章写什么
- 直接输出列表，不要任何额外文字`;

  const userPrompt = [
    `灵感: ${input.inspiration}`,
    `标题: ${title}`,
    `简介: ${description}`,
    input.tone ? `风格: ${input.tone}` : "",
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt, 2048);
  return parseOutline(result);
}

function parseOutline(text: string): OutlineSection[] {
  const sections: OutlineSection[] = [];
  const lines = text.trim().split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^\d+\.\d+/.test(trimmed)) continue; // skip sub-items for now

    const match = trimmed.match(/^(\d+)\.\s+(.+?)(?:\s*[-—]\s*(.+))?$/);
    if (!match) continue;

    const title = match[2].trim();
    const description = match[3]?.trim();

    sections.push({
      id: `sec_plan_${_stepId++}`,
      title,
      level: 1,
      description: description || undefined,
      status: "pending",
    });
  }

  return sections.length > 0 ? sections : [
    { id: `sec_plan_${_stepId++}`, title: "引言", level: 1, status: "pending" },
    { id: `sec_plan_${_stepId++}`, title: "正文", level: 1, status: "pending" },
    { id: `sec_plan_${_stepId++}`, title: "结语", level: 1, status: "pending" },
  ];
}

/* ─── Step 4: 标签 ─── */

export async function generateTags(input: PlanInput, title: string, description: string): Promise<string[]> {
  const sysPrompt = `你是标签生成专家。根据文章信息生成 3-5 个标签。

## 规则
- 标签要覆盖文章的核心主题、风格和领域
- 每个标签 2-5 个字
- 用逗号分隔输出，不要编号和前缀
- 直接输出：标签1, 标签2, 标签3`;

  const userPrompt = [
    `灵感: ${input.inspiration}`,
    `标题: ${title}`,
    `简介: ${description}`,
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt, 512);
  return result.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
}

/* ─── 全流程（组装用） ─── */

export type PlanStep = "idle" | "title" | "description" | "outline" | "tags" | "done";
export type PlanStepResult = { step: PlanStep; data: any };

export async function* generatePlanStream(input: PlanInput): AsyncGenerator<PlanStepResult> {
  // Step 1: Title
  yield { step: "title", data: null };
  const title = await generateTitle(input);
  yield { step: "title", data: title };

  if (!title) throw new Error("生成标题失败");

  // Step 2: Description
  yield { step: "description", data: null };
  const description = await generateDescription(input, title);
  yield { step: "description", data: description };

  // Step 3: Outline
  yield { step: "outline", data: null };
  const outline = await generateOutline(input, title, description);
  yield { step: "outline", data: outline };

  // Step 4: Tags
  yield { step: "tags", data: null };
  const tags = await generateTags(input, title, description);
  yield { step: "tags", data: tags };

  yield { step: "done", data: { title, description, outline, tags } };
}
