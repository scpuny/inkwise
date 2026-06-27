// plan.ts — 分步 AI 文章规划
// 不依赖 JSON 输出，每一步返回纯文本，逐层推进

import { sendChat, sendChatStream, type ChatMessage } from "./ai";
import { findSkill, getEffectivePhaseConfig, loadCustomSkills, type SkillPhase, type WritingSkill } from "../ai/writingSkill";
import { getProvidersSync } from "../storage/providerModels";
import type { OutlineSection } from "../ai/articleBlueprint";

/* ─── 逐步生成的结果类型 ─── */
export interface PartialPlan {
  title: string;
  description: string;
  outline: OutlineSection[];
  tags: string[];
  tone: string;
  targetAudience: string;
  targetWordCount: number;
  skillId?: string;
}


export interface PlanInput {
  inspiration: string;
  tone?: string;
  targetAudience?: string;
  targetWordCount?: number;
  projectContext?: string;
  projectName?: string;
  articleDescription?: string;
  skillId?: string;
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

/* ─── 技能辅助 ─── */

/** 模块级自定义技能缓存 */
let _customCache: WritingSkill[] | null = null;

export async function ensureSkillCache(): Promise<void> {
  if (_customCache === null) {
    try { _customCache = await loadCustomSkills(); }
    catch { _customCache = []; }
  }
}

export function clearSkillCache(): void {
  _customCache = null;
}

function resolveSkill(skillId?: string): WritingSkill | undefined {
  if (!skillId) return undefined;
  if (_customCache) {
    const c = _customCache.find(s => s.id === skillId);
    if (c) return c;
  }
  return findSkill(skillId);
}

/** 构建项目上下文提示块 */
function buildProjectContextBlock(ctx?: string, name?: string): string {
  if (!ctx) return "";
  const header = name ? `项目「${name}」的上下文信息` : "项目上下文信息";
  return `\n\n## ${header}\n当前写作关联了以下本地项目目录，请参考项目结构、代码符号和配置来进行写作。\n\`\`\`\n${ctx.slice(0, 4000)}\n\`\`\``;
}

/** 根据技能 ID 和阶段构建 system prompt，自动注入上下文 */
function buildSystemPrompt(phase: SkillPhase, skillId?: string, tone?: string, projectContext?: string, projectName?: string): string {
  const skill = resolveSkill(skillId);
  const config = getEffectivePhaseConfig(skill, phase);
  let prompt = config.systemPrompt;

  // 语气放在最前面，让 AI 从一开始就知道基调
  if (tone && tone.trim()) {
    prompt = `整体基调：${tone}。\n\n` + prompt;
  }

  // 技能声明了 project 上下文且可用时自动注入
  if (skill?.contextSources?.some(cs => cs.type === "project") && projectContext) {
    prompt += buildProjectContextBlock(projectContext, projectName);
  }

  return prompt;
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
  const sysPrompt = buildSystemPrompt("title", input.skillId, input.tone, input.projectContext, input.projectName);

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
  const sysPrompt = buildSystemPrompt("description", input.skillId, input.tone, input.projectContext, input.projectName);

  const userPrompt = [
    `灵感: ${input.inspiration}`,
    `标题: ${title}`,
    input.tone ? `风格: ${input.tone}` : "",
    input.targetAudience ? `目标读者: ${input.targetAudience}` : "",
    input.articleDescription ? `文章定位: ${input.articleDescription}` : "",
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt);
  return result.trim().replace(/^[""''""]|[""''""]$/g, "").trim();
}

/* ─── Step 3: 大纲 ─── */

export async function generateOutline(input: PlanInput, title: string, description: string): Promise<OutlineSection[]> {
  const sysPrompt = buildSystemPrompt("outline", input.skillId, input.tone, input.projectContext, input.projectName);

  const userPrompt = [
    input.projectName ? `关联项目: ${input.projectName}` : "",
    `灵感: ${input.inspiration}`,
    `标题: ${title}`,
    `简介: ${description}`,
    input.tone ? `风格: ${input.tone}` : "",
    input.targetAudience ? `目标读者: ${input.targetAudience}` : "",
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
  const sysPrompt = buildSystemPrompt("tags", input.skillId, input.tone, input.projectContext, input.projectName);

  const userPrompt = [
    `灵感: ${input.inspiration}`,
    `标题: ${title}`,
    `简介: ${description}`,
    input.targetAudience ? `目标读者: ${input.targetAudience}` : "",
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt, 512);
  return result.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
}

/* ─── 全流程（组装用） ─── */

export type PlanStep = "idle" | "title" | "description" | "outline" | "tags" | "done";
export type PlanStepResult = { step: PlanStep; data: any };

export async function* generatePlanStream(input: PlanInput): AsyncGenerator<PlanStepResult> {
  await ensureSkillCache();
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
  skillId?: string;
  projectContext?: string;
  projectName?: string;
  seriesContext?: string;
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

  const sysPrompt = buildSystemPrompt("writing", input.skillId, input.tone);

  // 注入项目上下文（关联代码目录时使用）
  let projectBlock = '';
  if (input.projectContext) {
    const name = input.projectName || '关联项目';
    projectBlock = `\n## 关联项目上下文\n以下是与文章主题关联的本地项目「${name}」的代码结构和示例，请引用实际代码来支撑文章内容：\n\`\`\`\n${input.projectContext.slice(0, 4000)}\n\`\`\``;
  }

  // 注入系列文章上下文
  let seriesBlock = '';
  if (input.seriesContext) {
    seriesBlock = `\n## 系列文章上下文\n${input.seriesContext}\n\n### 写作要求\n- 自然引用前文已讨论的概念，用「如上一篇文章所述」或 Markdown 链接 [上一篇: 标题](#article-{id}) 等方式衔接\n- 如果 context 中有提供「上一篇」的链接标记，用 Markdown 链接格式插入\n- 结尾处如果下文有预告，请附上自然的下一篇引子并用 Markdown 链接格式标记\n- 整体风格、术语体系与系列保持一致\n- 如果关联了项目目录，在涉及代码实现时可引用项目中的真实代码结构`;
  }

  const userPrompt = [
    `标题: ${input.title}`,
    `简介: ${input.description}`,
    input.tone ? `风格: ${input.tone}` : '',
    input.targetAudience ? `目标读者: ${input.targetAudience}` : '',
    input.targetWordCount ? `目标字数: ~${input.targetWordCount} 字` : '',
    '',
    '## 大纲',
    outlineText,
    projectBlock,
    seriesBlock,
    '',
    '请根据以上大纲写一篇完整的文章。大纲仅用于确定文章方向，并非写作顺序。你可以根据行文需要打乱顺序、倒叙、插叙或自由组织结构。开头、过渡、章节安排完全由你根据内容和风格自然决定。直接输出 Markdown 内容。\n\n## 格式要求\n- 所有二级标题（##）按出现顺序标号：`## 1. 标题`、`## 2. 标题`……\n- 三级标题（###）在其父级下按顺序标号：`### 1.1 子标题`、`### 1.2 子标题`……\n- 如果`##`标题已经在 text 中以`数字点`开头（如`1. `），则无需重复编号。',
  ].filter(Boolean).join('\n');

  const result = await askAI(sysPrompt, userPrompt, 8192);
  
  // 后处理：标题编号 + 系列导航
  let finalContent = ensureHeadingNumbers(result.trim());
  finalContent = appendSeriesNavigation(finalContent, input);
  return finalContent;
}


/**
 * 流式版本：根据规划结果（标题、简介、大纲）生成完整文章内容。
 * onToken 在每收到一个 token 时被调用，用于实时更新编辑器内容。
 */
export async function generateFullArticleStream(
  input: ArticleGenInput,
  onToken?: (token: string) => void,
): Promise<string> {
  const outlineText = input.outline.map((s, i) => {
    const desc = s.description ? ` - ${s.description}` : '';
    return `${i + 1}. ${s.title}${desc}`;
  }).join('\n');

  const sysPrompt = buildSystemPrompt("writing", input.skillId, input.tone);

  // 注入项目上下文（关联代码目录时使用）
  let projectBlock = '';
  if (input.projectContext) {
    const name = input.projectName || '关联项目';
    projectBlock = `\n## 关联项目上下文\n以下是与文章主题关联的本地项目「${name}」的代码结构和示例，请引用实际代码来支撑文章内容：\n\`\`\`\n${input.projectContext.slice(0, 4000)}\n\`\`\``;
  }

  // 注入系列文章上下文
  let seriesBlock = '';
  if (input.seriesContext) {
    seriesBlock = `\n## 系列文章上下文\n${input.seriesContext}\n\n### 写作要求\n- 自然引用前文已讨论的概念，用「如上一篇文章所述」或 Markdown 链接 [上一篇: 标题](#article-{id}) 等方式衔接\n- 如果 context 中有提供「上一篇」的链接标记，用 Markdown 链接格式插入\n- 结尾处如果下文有预告，请附上自然的下一篇引子并用 Markdown 链接格式标记\n- 整体风格、术语体系与系列保持一致\n- 如果关联了项目目录，在涉及代码实现时可引用项目中的真实代码结构`;
  }

  const userPrompt = [
    `标题: ${input.title}`,
    `简介: ${input.description}`,
    input.tone ? `风格: ${input.tone}` : '',
    input.targetAudience ? `目标读者: ${input.targetAudience}` : '',
    input.targetWordCount ? `目标字数: ~${input.targetWordCount} 字` : '',
    '',
    '## 大纲',
    outlineText,
    projectBlock,
    seriesBlock,
    '',
    '请根据以上大纲写一篇完整的文章。大纲仅用于确定文章方向，并非写作顺序。你可以根据行文需要打乱顺序、倒叙、插叙或自由组织结构。开头、过渡、章节安排完全由你根据内容和风格自然决定。直接输出 Markdown 内容。\n\n## 格式要求\n- 所有二级标题（##）按出现顺序标号：`## 1. 标题`、`## 2. 标题`……\n- 三级标题（###）在其父级下按顺序标号：`### 1.1 子标题`、`### 1.2 子标题`……\n- 如果`##`标题已经在 text 中以`数字点`开头（如`1. `），则无需重复编号。',
  ].filter(Boolean).join('\n');

  const provider = getProvider();
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");

  const messages: ChatMessage[] = [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ];

  const result = await sendChatStream({
    providerId: provider.id,
    model: provider.models[0],
    messages,
    temperature: 0.7,
    maxTokens: 8192,
  }, onToken);

  // 后处理：标题编号 + 系列导航
  let finalContent = ensureHeadingNumbers(result.trim());
  finalContent = appendSeriesNavigation(finalContent, input);
  return finalContent;
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
  skillId?: string;
  totalSections?: number;
  previousSectionTitle?: string;
  previousSectionContent?: string;
}

/**
 * 根据大纲中的一节信息，生成该节的完整内容。
 * 提供上下文（前节内容）保持文风连贯。
 */
export async function writeArticleSection(input: SectionWriteInput): Promise<string> {
  const sysPrompt = buildSystemPrompt("writing", input.skillId, input.tone);

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

/**
 * 流式版本：根据大纲中的一节信息，逐 token 生成该节内容。
 * 提供上下文（前节内容）保持文风连贯。onToken 在每收到一个 token 时被调用。
 */
export async function writeArticleSectionStream(
  input: SectionWriteInput,
  onToken?: (token: string) => void,
): Promise<string> {
  const sysPrompt = buildSystemPrompt("writing", input.skillId, input.tone);

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

  const provider = getProvider();
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");

  const messages: ChatMessage[] = [
    { role: "system", content: sysPrompt },
    { role: "user", content: userPrompt },
  ];

  const result = await sendChatStream({
    providerId: provider.id,
    model: provider.models[0],
    messages,
    temperature: 0.7,
    maxTokens: 4096,
  }, onToken);

  return normalizeMarkdownBreaks(result.trim());
}



/**
 * 后处理：确保所有 H2/H3 标题带有序号。
 * 如果 AI 已自动编号则跳过，遗漏的补齐。
 * H2 编号: ## 1. Title, ## 2. Title ...
 * H3 编号: ### 1.1 Sub, ### 1.2 Sub ...（基于父级 H2 序号）
 */
function ensureHeadingNumbers(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let h2Counter = 0;
  let h3Counter = 0;
  let inCodeBlock = false;

  for (const line of lines) {
    // 跳过代码块
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      out.push(line);
      continue;
    }
    if (inCodeBlock) { out.push(line); continue; }

    // H2: ## Title
    const h2Match = line.match(/^(#{2})\s+(.+)$/);
    if (h2Match) {
      h2Counter++;
      h3Counter = 0;
      const text = h2Match[2].trim();
      // 检查是否已编号
      if (!/^\d+\.\s/.test(text)) {
        out.push(`## ${h2Counter}. ${text}`);
      } else {
        out.push(line);
      }
      continue;
    }

    // H3: ### Title
    const h3Match = line.match(/^(#{3})\s+(.+)$/);
    if (h3Match) {
      h3Counter++;
      const text = h3Match[2].trim();
      if (!/^\d+\.\d+\.\s/.test(text)) {
        out.push(`### ${h2Counter}.${h3Counter} ${text}`);
      } else {
        out.push(line);
      }
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

/**
 * 系列文章后处理：检查内容末尾是否已有导航区块，
 * 若没有则自动追加。
 */
function appendSeriesNavigation(content: string, input: ArticleGenInput): string {
  // 仅当有系列上下文时才处理
  if (!input.seriesContext) return content;
  
  // 提取上一篇/下一篇的信息（从 seriesContext 中解析）
  const prevMatch = input.seriesContext.match(/上一篇：\[(.+?)\]\(#article-(.+?)\)/);
  const nextMatch = input.seriesContext.match(/下一篇：\[(.+?)\]\(#article-(.+?)\)/);
  
  // 检查是否已有导航区块
  if (content.includes("**系列导航**") || content.includes("系列导航")) {
    return content;
  }
  
  // 构建导航区块
  const navLines: string[] = [];
  navLines.push('');
  navLines.push('---');
  navLines.push('**系列导航**');
  
  if (prevMatch) {
    navLines.push(`上一篇：[${prevMatch[1]}](#article-${prevMatch[2]})`);
  }
  if (nextMatch) {
    navLines.push(`下一篇：[${nextMatch[1]}](#article-${nextMatch[2]})`);
  }
  
  if (navLines.length > 1) {
    return content + navLines.join('\n');
  }
  
  return content;
}
