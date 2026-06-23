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
  projectContext?: string;
  projectName?: string;
  articleDescription?: string;
}

/* ─── 分步生成器 ───
   每一步都只让 AI 输出一小段纯文本，前端解析。
   不依赖 JSON 格式，大大降低解析失败率。
*/



/** 构建项目上下文提示块（注入到每一步的 system prompt 中） */
function buildProjectContextPrompt(ctx?: string, name?: string): string {
  if (!ctx) return "";
  const header = name ? `项目「${name}」的上下文信息` : "项目上下文信息";
  return `

## ${header}
当前写作关联了以下本地项目目录，请参考项目结构、代码符号和配置来进行写作。
\`\`\`
${ctx.slice(0, 4000)}
\`\`\`
`;
}

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
  const projectCtx = buildProjectContextPrompt(input.projectContext, input.projectName);
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
- 直接输出列表，不要任何额外文字${projectCtx}`;

  const userPrompt = [
    input.projectName ? `关联项目: ${input.projectName}` : "",
    `灵感: ${input.inspiration}`,
    `标题: ${title}`,
    `简介: ${description}`,
    input.tone ? `风格: ${input.tone}` : "",
    input.articleDescription ? `文章定位: ${input.articleDescription}` : "",
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

/* ─── 全文生成 ─── */

export interface ArticleGenInput {
  title: string;
  description: string;
  outline: OutlineSection[];
  tone?: string;
  targetAudience?: string;
  targetWordCount?: number;
}

/**
 * 根据规划结果（标题、简介、大纲）生成完整文章内容。
 * 一步生成全文，返回 Markdown 格式的内容。
 */
export async function generateFullArticle(input: ArticleGenInput): Promise<string> {
  const outlineText = input.outline.map((s, i) => {
    const desc = s.description ? ` - ${s.description}` : '';
    return `${i + 1}. ${s.title}${desc}`;
  }).join('\n');

  const sysPrompt = `你是一位资深中文写作者。根据文章规划信息，写一篇完整的文章。

## 要求
- 严格按照大纲结构写作，每个章节都要覆盖
- 使用流畅自然的中文
- 使用 Markdown 格式，## 章节标题使用 1. 2. 3. 编号（如 ## 1. 引言、## 2. 环境准备）
- ### 子章节不要额外编号
- 每个章节至少 2-3 个段落，每段 3-5 句
- 章节之间要有自然的过渡
- 直接输出完整的 Markdown 内容，无需额外说明
- 开头不要重复文章标题（会在外部添加）`;

  const userPrompt = [
    `标题: ${input.title}`,
    `简介: ${input.description}`,
    input.tone ? `风格: ${input.tone}` : '',
    input.targetAudience ? `目标读者: ${input.targetAudience}` : '',
    input.targetWordCount ? `目标字数: ~${input.targetWordCount} 字` : '',
    '',
    '## 大纲',
    outlineText,
    '',
    '请根据以上大纲写一篇完整的文章。直接输出 Markdown 内容，从第一个章节开始。',
  ].filter(Boolean).join('\n');

  const result = await askAI(sysPrompt, userPrompt, 4096);
  return normalizeMarkdownBreaks(result.trim());
}

/**
 * 规范化 Markdown 换行：确保块级元素（标题、引用、代码块等）
 * 前后有正确的空行分隔，防止 AI 输出全部挤在一行。
 */
function normalizeMarkdownBreaks(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];

  const isBlockLine = (l: string) =>
    /^(#{1,6}\s|>|---|\*\*\*|```)/.test(l);
  const isListLine = (l: string) =>
    /^\s*(\d+\.\s|[-*+]\s)/.test(l);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);

    const next = lines[i + 1];
    if (next === undefined) break;

    // 如果下一行是块级元素（标题/引用/代码块），确保前面有空行
    if (line !== '' && next !== '' && isBlockLine(next)) {
      out.push('');
      continue;
    }

    // 连续两行非空、非块、非列表的纯文本 → 段落之间加空行
    if (
      line !== '' && next !== '' &&
      !isBlockLine(line) && !isBlockLine(next) &&
      !isListLine(line) && !isListLine(next)
    ) {
      // 检查是否已经隔了空行（往回看）
      if (i === 0 || lines[i - 1] !== '') {
        out.push('');
      }
    }
  }

  return out.join('\n');
}

/* ─── 逐节写作 ─── */

export interface SectionWriteInput {
  sectionNumber: string;
  title: string;
  description?: string;
  articleTitle: string;
  articleDescription?: string;
  tone?: string;
  targetWordCount?: number;
  totalSections?: number;
  previousSectionTitle?: string;
  previousSectionContent?: string;
}

/**
 * 根据大纲中的一节信息，生成该节的完整内容。
 * 提供上下文（前节内容）保持文风连贯。
 */
export async function writeArticleSection(input: SectionWriteInput): Promise<string> {
  const sysPrompt = `你是一位资深中文写作者。根据文章规划和当前章节信息，撰写该章节的完整内容。

## 要求
- 章节标题请包含序号（例如 ## 2. 环境准备），序号由外部提供
- 子章节（###）不要额外编号
- 使用流畅自然的中文
- 段落之间用空行分隔，适当使用加粗、引用等 Markdown 格式增加可读性
- 内容要具体充实，有细节、例子或数据支撑，不要空洞的套话
- 根据目标字数决定段落数量和内容深度，该长则长该短则短
- 如果提供了前节内容，保持文风和逻辑连贯
- 直接输出章节内容，不要标题、不要额外说明`;

  const perSectionWords = input.targetWordCount && input.totalSections
    ? Math.ceil(input.targetWordCount / input.totalSections)
    : 400;

  const userPrompt = [
    `文章标题: ${input.articleTitle}`,
    input.articleDescription ? `文章简介: ${input.articleDescription}` : '',
    input.tone ? `风格: ${input.tone}` : '',
    `本节省略字数: ~${perSectionWords} 字`,
    '',
    `当前章节: ${input.title}`,
    input.description ? `章节说明: ${input.description}` : '',
    '',
    input.previousSectionTitle && input.previousSectionContent
      ? `前节标题: ${input.previousSectionTitle}\n\n前节内容:\n${input.previousSectionContent.slice(0, 800)}`
      : '这是文章的第一节。',
    '',
    `当前章节序号: ${input.sectionNumber}
请撰写「${input.title}」的内容，约 ${perSectionWords} 字。直接输出内容。`,
  ].filter(Boolean).join('\n');

  const result = await askAI(sysPrompt, userPrompt, 4096);
  return normalizeMarkdownBreaks(result.trim());
}
