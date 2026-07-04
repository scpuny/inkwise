// plan.ts — AI 文章规划与生成
// 使用 agentEngine 的 tool calling 模式获取项目文件上下文
import { sendChatStream, type ChatMessage } from "./ai";
import { resolveModel } from "../config/globalAIConfig";
import { runAgentLoop, PROJECT_TOOLS, type ProjectToolContext } from "./agentEngine";
import { findSkill, getEffectivePhaseConfig, loadCustomSkills, type WritingSkill } from "../ai/writingSkill";
import { getProvidersSync } from "../storage/providerModels";
import type { OutlineSection } from "../ai/articleBlueprint";

// ─── Types ───

export interface PartialPlan {
  title: string;
  description: string;
  outline: OutlineSection[];
  tags: string[];
  tone: string;
  targetAudience: string;
  targetWordCount: number;
  skillId?: string;
  /** Project structure insights from planning-phase exploration (tool-based) */
  projectInsights?: string;
  styleId?: string;
  actionId?: string;
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
  collectionId?: string;
  /** linked folder path for tool-based file reading */
  linkedFolder?: string;
  /** Pre-filled title (from series plan) — skips AI title generation */
  prefilledTitle?: string;
  /** Pre-filled description (from series plan) — skips AI description generation */
  prefilledDescription?: string;
  styleId?: string;
  actionId?: string;
}

export type PlanStep = "idle" | "title" | "description" | "outline" | "tags" | "explored" | "done";
export type PlanStepResult = { step: PlanStep; data: any };

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
  /** linked folder path: enables tool-based file reading */
  linkedFolder?: string;
}

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
  /** linked folder path: enables tool-based file reading */
  linkedFolder?: string;
}

// ─── Skill helpers ───

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

// ─── Provider ───

function getProvider() {
  const providers = getProvidersSync();
  return providers.find((p) => p.enabled && p.models.length > 0) || null;
}

// ─── Prompt builders ───

function buildSystemPrompt(phase: string, skillId?: string, tone?: string): string {
  const skill = resolveSkill(skillId);
  const config = getEffectivePhaseConfig(skill, phase as any);
  let prompt = config.systemPrompt;

  if (tone && tone.trim()) {
    prompt = "整体基调：" + tone + "。\n\n" + prompt;
  }

  return prompt;
}

// ─── Tool-based article generation (via AgentEngine) ───

const ARTICLE_WRITER_SYSTEM_PROMPT = "你是一位资深技术文章写作者。你的任务是为给定的项目写一篇高质量的技术文章。\n\n## 可用工具\n你可以在写作过程中随时使用以下工具来获取项目文件内容：\n- `read_project_files`: 读取项目源代码文件，获取真实的代码示例\n- `list_project_files`: 查看项目目录结构\n- `search_project_files`: 搜索文件名匹配的文件\n\n## 写作原则\n1. 所有代码示例必须直接从项目中读取真实代码，不要自己编造\n2. 文章中的代码块应是项目中实际存在的文件内容\n3. 在引用代码前，先用 `read_project_files` 读取对应文件\n4. 如果需要了解项目结构，用 `list_project_files` 查看目录\n5. 如果不确定某个功能在哪个文件中，用 `search_project_files` 搜索\n\n## 开篇要求\n- **前 2 段内亮出核心卖点**，不要用背景铺垫暖场\n- 第一段直接用具体场景、反差或问题切入，避免\"大家好\"\"欢迎回到\"等冗余开场白\n\n## 行文规范\n- 受众是两类读者：技术开发者和有技术背景的创作者，为两者都提供价值\n- 段落控制 3-5 行，适配手机阅读；长短段交替\n- 整体调性统一：技术部分专业严谨，非技术部分简洁平实，不要混搭口语与硬核术语\n- 超长复合句拆成短句，避免同一个观点反复说\n\n## 技术内容准则\n- 贴代码时在代码上方用一句话说明这段代码的作用\n- 结构体/接口定义下方用注释解释每个字段的用途\n- 复杂概念用通俗类比降低理解成本\n- 涉及业务逻辑链路时，给出文本流程图（用 -> 连接）\n- 对易混淆概念做对比说明\n\n## 产品价值\n- 在结语前留一段对比分析：当前方案与市面上通用方案的核心差异\n- 突出本地优先、隐私安全、细粒度控制等差异化卖点\n- 结语简要预告下篇内容\n\n## 输出要求\n- 直接输出 Markdown 格式的完整文章\n- 文章标题已为 #（一级），开头段落直接接在标题后面，**不要用\"引言\"之类的二级标题**\n- 所有二级标题（##）按出现顺序标号：`## 1. 标题`、`## 2. 标题`\n- 三级标题（###）在其父级下按顺序标号：`### 1.1 子标题`、`### 1.2 子标题`\n- 使用流畅自然的中文";

/**
 * 使用 AgentEngine（tool calling）生成完整文章。
 * AI 主动通过工具读取项目文件，确保代码真实性。
 */
export async function generateFullArticleWithTools(
  input: ArticleGenInput,
  onToken?: (token: string) => void,
  onToolEvent?: (event: import("./agentEngine").ToolEvent) => void,
): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("请先在设置中配置 AI 提供商");
  }

  // Build user prompt
  const parts: string[] = [];
  parts.push("请根据以下信息写一篇完整的文章：");
  parts.push("");
  parts.push("标题：" + input.title);
  if (input.description) parts.push("简介：" + input.description);
  if (input.tone) parts.push("风格：" + input.tone);
  if (input.targetAudience) parts.push("目标读者：" + input.targetAudience);
  if (input.targetWordCount) parts.push("目标字数：约 " + input.targetWordCount + " 字");

  // Include project structure context so AI doesn't need to re-explore
  if (input.projectContext) {
    parts.push("");
    parts.push("## 项目结构");
    parts.push("以下是你已经知道的当前项目结构和关键文件。**不要重新探索目录**，直接读具体文件取代码示例。");
    parts.push("```");
    parts.push(String(input.projectContext || "").slice(0, 8000));
    parts.push("```");
  }

  parts.push("");
  parts.push("## 文章大纲");
  for (const sec of input.outline) {
    const indent = "  ".repeat(sec.level - 1);
    parts.push(indent + "- " + sec.title + (sec.description ? "：" + sec.description : ""));
  }
  if (input.seriesContext) {
    parts.push("");
    parts.push("## 系列上下文");
    parts.push(input.seriesContext);
  }
  const userMessage = parts.join("\n");

  // Build tool context if linked folder is set
  let toolContext: ProjectToolContext | undefined;
  if (input.linkedFolder) {
    toolContext = { projectPath: input.linkedFolder };
  }

  // If no tool context, fall back to legacy flow
  if (!toolContext) {
    return generateFullArticleStream(input, onToken);
  }

  try {
    const result = await runAgentLoop({
      systemPrompt: ARTICLE_WRITER_SYSTEM_PROMPT,
      userMessage,
      tools: PROJECT_TOOLS,
      toolContext,
      maxToolRounds: 20,
      requestTimeoutMs: 180000,
      onToolEvent,
      onToken,
    });

    // Post-process: fix heading numbers, normalize breaks
    let content = result.content || "";
    content = ensureHeadingNumbers(content);
    content = normalizeMarkdownBreaks(content);
    content = appendSeriesNavigation(content, input);
    return content;
  } catch (err: any) {
    console.error("[generateFullArticleWithTools] Failed:", err);
    // Send error event
    onToolEvent?.({
      type: "error",
      toolName: "generateFullArticleWithTools",
      toolCallId: "fallback",
      arguments: "",
      result: typeof err === "string" ? err : err?.message || "未知错误",
      summary: "工具调用模式失败：" + (typeof err === "string" ? err : err?.message || "未知错误") + "，回退到传统模式",
    });
    // Fallback to legacy
    return generateFullArticleStream(input, onToken);
  }
}

// ─── Stream-based article generation with project context ───

export async function generateFullArticleStream(
  input: ArticleGenInput,
  onToken?: (token: string) => void,
  onToolEvent?: (event: import("./agentEngine").ToolEvent) => void,
): Promise<string> {
  const provider = getProvider();
  if (!provider) {
    throw new Error("请先在设置中配置 AI 提供商");
  }

  const skill = resolveSkill(input.skillId);
  const config = getEffectivePhaseConfig(skill, "writing");
  let systemPrompt = config.systemPrompt;

  if (input.tone && input.tone.trim()) {
    systemPrompt = "整体基调：" + input.tone + "。\n\n" + systemPrompt;
  }

  // Build user message
  const lines: string[] = [];
  lines.push("请根据以下信息写一篇完整的文章：");
  lines.push("");
  lines.push("标题：" + input.title);
  if (input.description) lines.push("简介：" + input.description);

  if (input.projectContext) {
    if (input.projectName) {
      lines.push("关联项目：" + input.projectName);
    }
    lines.push("");
    lines.push("项目文件内容：\n```\n" + String(input.projectContext || "").slice(0, 30000) + "\n```");
  }

  lines.push("");
  lines.push("## 文章大纲");
  for (const sec of input.outline) {
    const indent = "  ".repeat(sec.level - 1);
    lines.push(indent + "- " + sec.title + (sec.description ? "：" + sec.description : ""));
  }

  if (input.seriesContext) {
    lines.push("");
    lines.push("## 系列上下文");
    lines.push(input.seriesContext);
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: lines.join("\n") },
  ];

  let fullContent = "";
  try {
    fullContent = await sendChatStream(
      {
        providerId: provider.id,
        model: resolveModel() ?? provider.models[0]?.id ?? '',
        messages,
        temperature: 0.7,
        maxTokens: 8192,
      },
      (token) => {
        fullContent += token;
        onToken?.(token);
      },
    );
  } catch (err: any) {
    console.error("[generateFullArticleStream] Failed:", err);
    throw err;
  }

  let result = fullContent || "";
  result = ensureHeadingNumbers(result);
  result = normalizeMarkdownBreaks(result);
  result = appendSeriesNavigation(result, input);
  return result;
}

// ─── Plan generation (streaming) ───

export async function* generatePlanStream(input: PlanInput): AsyncGenerator<PlanStepResult> {
  yield { step: "idle", data: null };

  // Silently explore project structure if linked folder — runs before user
  // sees any output so the outline is based on real project understanding
  // First check if collection-level cached insights exist
  let projectInsights = "";
  if (input.linkedFolder) {
    const { getStoredProjectInsights } = await import("../storage/collections/projectContext");
    projectInsights = getStoredProjectInsights(input.collectionId || "") || "";
    if (!projectInsights) {
      projectInsights = await exploreProjectStructure(input.linkedFolder).catch(function(e: any) {
        console.warn("[generatePlanStream] Project exploration failed:", e);
        return "";
      });
    }
  }

  // Yield project insights so handleStartPlan can capture them into partialPlan
  yield { step: "explored", data: projectInsights || "" };

  const enriched = projectInsights
    ? { ...input, projectContext: projectInsights }
    : input;

  // Generate title (skip if pre-filled from series plan)
  const title = input.prefilledTitle || await generateTitle(enriched);
  yield { step: "title", data: title };

  // Generate description (skip if pre-filled from series plan)
  const description = input.prefilledDescription || await generateDescription(enriched, title);
  yield { step: "description", data: description };

  // Generate outline
  const outline = await generateOutline(enriched, title, description);
  yield { step: "outline", data: outline };

  // Generate tags
  const tags = await generateTags(input, title, description);
  yield { step: "tags", data: tags };

  yield { step: "done", data: null };
}

async function exploreProjectStructure(folderPath: string): Promise<string> {
  const instructions = "你是一个项目结构分析助手。你的任务是用工具探索给定项目的目录结构和关键文件，返回项目的技术栈、模块划分和核心架构的简要总结。";
  const result = await runAgentLoop({
    systemPrompt: instructions,
    userMessage: "请探索这个项目的目录结构，列出根目录和主要子目录的文件，识别技术栈（语言、框架、构建工具）。给出简洁的总结（200字以内）。",
    tools: PROJECT_TOOLS,
    toolContext: { projectPath: folderPath },
    maxToolRounds: 4,
    requestTimeoutMs: 60000,
  });
  return result.content || "";
}

// ─── Individual plan steps ───

export async function generateTitle(input: PlanInput): Promise<string> {
  const skill = resolveSkill(input.skillId);
  const config = getEffectivePhaseConfig(skill, "title");
  let sysPrompt = config.systemPrompt;

  if (input.tone && input.tone.trim()) {
    sysPrompt = "整体基调：" + input.tone + "。\n\n" + sysPrompt;
  }

  const ctxBlock = input.projectContext ? buildProjectContextBlockForPlan(input.projectContext, input.projectName) : "";
  const userPrompt = [
    "请根据以下信息生成标题：",
    "",
    "灵感：" + input.inspiration,
    input.articleDescription ? "文章定位：" + input.articleDescription : "",
    input.targetAudience ? "目标读者：" + input.targetAudience : "",
    ctxBlock,
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt, 256);
  return result.trim().replace(/^["']|["']$/g, "").trim();
}

export async function generateDescription(input: PlanInput, title: string): Promise<string> {
  const skill = resolveSkill(input.skillId);
  const config = getEffectivePhaseConfig(skill, "description");
  let sysPrompt = config.systemPrompt;

  if (input.tone && input.tone.trim()) {
    sysPrompt = "整体基调：" + input.tone + "。\n\n" + sysPrompt;
  }

  const ctxBlock = input.projectContext ? buildProjectContextBlockForPlan(input.projectContext, input.projectName) : "";
  const userPrompt = [
    "请根据以下信息生成文章简介（一句话概括）：",
    "",
    input.projectName ? "关联项目：" + input.projectName : "",
    "灵感：" + input.inspiration,
    "标题：" + title,
    input.articleDescription ? "文章定位：" + input.articleDescription : "",
    ctxBlock,
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt, 512);
  return result.trim().replace(/^["']|["']$/g, "").trim();
}

export async function generateOutline(input: PlanInput, title: string, description: string): Promise<OutlineSection[]> {
  const sysPrompt = buildSystemPrompt("outline", input.skillId, input.tone);
  const userPrompt = [
    "请根据以下信息生成文章大纲：",
    "",
    input.projectName ? "关联项目：" + input.projectName : "",
    "灵感：" + input.inspiration,
    "标题：" + title,
    "简介：" + description,
    input.tone ? "风格：" + input.tone : "",
    input.targetAudience ? "目标读者：" + input.targetAudience : "",
    input.articleDescription ? "文章定位：" + input.articleDescription : "",
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt, 2048);
  return parseOutline(result);
}

export async function generateTags(input: PlanInput, title: string, description: string): Promise<string[]> {
  const sysPrompt = buildSystemPrompt("tags", input.skillId, input.tone);
  const userPrompt = [
    "灵感：" + input.inspiration,
    "标题：" + title,
    "简介：" + description,
    input.targetAudience ? "目标读者：" + input.targetAudience : "",
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt, 512);
  return result.split(/[,，]/).map((t) => t.trim()).filter(Boolean);
}

// ─── Section writing ───

export async function writeArticleSection(
  input: SectionWriteInput,
  onToken?: (token: string) => void,
  onDone?: (content: string) => void,
): Promise<string> {
  if (!input.linkedFolder) {
    return writeArticleSectionLegacy(input, onToken, onDone);
  }

  // For linked folders, use tool-based section writing
  const provider = getProvider();
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");

  const skill = resolveSkill(input.skillId);
  const config = getEffectivePhaseConfig(skill, "writing");
  let systemPrompt = config.systemPrompt;

  if (input.tone && input.tone.trim()) {
    systemPrompt = "整体基调：" + input.tone + "。\n\n" + systemPrompt;
  }

  const userPrompt = [
    "请写文章的以下章节：",
    "",
    "文章标题：" + input.articleTitle,
    "章节号：" + input.sectionNumber,
    "章节标题：" + input.title,
    input.description ? "章节描述：" + input.description : "",
    input.articleDescription ? "文章简介：" + input.articleDescription : "",
    input.totalSections ? "总章节数：" + input.totalSections : "",
    input.targetWordCount ? "目标字数：约 " + Math.floor(input.targetWordCount * 0.3) + " 字" : "",
    input.previousSectionTitle ? "上一章标题：" + input.previousSectionTitle : "",
    input.previousSectionContent ? "上一章内容：\n```\n" + input.previousSectionContent.slice(0, 3000) + "\n```" : "",
    "",
    "注意：如果需要引用项目代码，请使用 read_project_files 工具读取真实源码。不要自己编造代码示例。",
  ].filter(Boolean).join("\n");

  try {
    const result = await runAgentLoop({
      systemPrompt: "你是一位专业的技术文章作者。" + systemPrompt,
      userMessage: userPrompt,
      tools: PROJECT_TOOLS,
      toolContext: { projectPath: input.linkedFolder },
      maxToolRounds: 8,
      requestTimeoutMs: 120000,
      onToken,
    });

    const content = result.content || "";
    onDone?.(content);
    return content;
  } catch (err: any) {
    console.error("[writeArticleSection] Tool mode failed, falling back:", err);
    return writeArticleSectionLegacy(input, onToken, onDone);
  }
}

async function writeArticleSectionLegacy(
  input: SectionWriteInput,
  onToken?: (token: string) => void,
  onDone?: (content: string) => void,
): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");

  const skill = resolveSkill(input.skillId);
  const config = getEffectivePhaseConfig(skill, "writing");
  let systemPrompt = config.systemPrompt;

  if (input.tone && input.tone.trim()) {
    systemPrompt = "整体基调：" + input.tone + "。\n\n" + systemPrompt;
  }

  const userPrompt = [
    "请写文章的以下章节：",
    "",
    "文章标题：" + input.articleTitle,
    "章节号：" + input.sectionNumber,
    "章节标题：" + input.title,
    input.description ? "章节描述：" + input.description : "",
    input.articleDescription ? "文章简介：" + input.articleDescription : "",
    input.totalSections ? "总章节数：" + input.totalSections : "",
    input.targetWordCount ? "目标字数：约 " + Math.floor(input.targetWordCount * 0.3) + " 字" : "",
    input.previousSectionTitle ? "上一章标题：" + input.previousSectionTitle : "",
    input.previousSectionContent ? "上一章内容：\n```\n" + input.previousSectionContent.slice(0, 3000) + "\n```" : "",
  ].filter(Boolean).join("\n");

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let fullContent = "";
  const content = await sendChatStream(
    {
      providerId: provider.id,
      model: resolveModel() ?? provider.models[0]?.id ?? '',
      messages,
      temperature: 0.7,
      maxTokens: 4096,
    },
    (token) => {
      fullContent += token;
      onToken?.(token);
    },
  );

  const result = content || fullContent || "";
  onDone?.(result);
  return result;
}

// ─── Utility ───

function buildProjectContextBlockForPlan(ctx: string, name?: string): string {
  if (!ctx) return "";
  const header = name ? "项目「" + name + "」的上下文信息" : "项目上下文信息";
  return "\n\n## " + header + "\n当前写作关联了以下本地项目目录，请参考项目结构、代码符号和配置来进行写作。\n```\n" + ctx.slice(0, 4000) + "\n```";
}

async function askAI(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string> {
  const provider = getProvider();
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  return sendChatStream(
    {
      providerId: provider.id,
      model: resolveModel() ?? provider.models[0]?.id ?? '',
      messages,
      temperature: 0.7,
      maxTokens,
    },
  );
}

function parseOutline(text: string): OutlineSection[] {
  const sections: OutlineSection[] = [];
  const lines = text.trim().split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip sub-numbered items like "1.1" or "2.3.1"
    if (/^\d+\.\d+/.test(trimmed)) continue;

    let title = "";
    let description = "";
    let level: 1 | 2 | 3 = 1;

    // Pattern 1: "## title" or "### title" (markdown heading)
    let match = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      level = (match[1].length >= 3 ? 3 : match[1].length >= 2 ? 2 : 1) as 1 | 2 | 3;
      const rest = match[2].trim();
      const descMatch = rest.match(/^(.+?)\s*[-—]\s*(.+)$/);
      if (descMatch) {
        title = descMatch[1].trim();
        description = descMatch[2].trim();
      } else {
        title = rest;
      }
    }

    // Pattern 2: "1. title - desc" or "1、title——desc" (numbered)
    if (!match) {
      match = trimmed.match(/^(\d+)[.、]\s*(.+?)(?:\s*[-—]\s*(.+))?$/);
      if (match) {
        title = match[2].trim();
        description = (match[3]?.trim() || "");
      }
    }

    // Pattern 3: "1) title - desc" (parenthetical number)
    if (!match) {
      match = trimmed.match(/^(\d+)\)\s*(.+?)(?:\s*[-—]\s*(.+))?$/);
      if (match) {
        title = match[2].trim();
        description = (match[3]?.trim() || "");
      }
    }

    // Pattern 4: "- title - desc" or "* title - desc" (bullet)
    if (!match) {
      match = trimmed.match(/^[-*]\s+(.+?)(?:\s*[-—]\s*(.+))?$/);
      if (match) {
        title = match[1].trim();
        description = (match[2]?.trim() || "");
      }
    }

    // Pattern 5: Plain title line — only if short (likely a title, not paragraph)
    if (!match && trimmed.length < 100 && !trimmed.endsWith("。") && !trimmed.endsWith(".") && !trimmed.endsWith("！") && !trimmed.endsWith("？")) {
      const descMatch = trimmed.match(/^(.+?)\s*[-—]\s*(.+)$/);
      if (descMatch) {
        title = descMatch[1].trim();
        description = descMatch[2].trim();
      } else {
        title = trimmed;
      }
    }

    if (!title) continue;

    sections.push({
      id: "sec_plan_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      title: title.replace(/^\*\*|\*\*$/g, "").trim(),
      level,
      description: description || undefined,
      status: "pending",
    });
  }

  return sections.length > 0 ? sections : [
    { id: "sec_plan_" + Date.now() + "_1", title: "引言", level: 1, status: "pending" },
    { id: "sec_plan_" + Date.now() + "_2", title: "正文", level: 1, status: "pending" },
    { id: "sec_plan_" + Date.now() + "_3", title: "结语", level: 1, status: "pending" },
  ];
}

// ─── Post-processing ───

function ensureHeadingNumbers(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let h2Counter = 0;
  let h3Counter = 0;
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      out.push(line);
      continue;
    }
    if (inCodeBlock) { out.push(line); continue; }

    const h2Match = line.match(/^(#{2})\s+(.+)$/);
    if (h2Match) {
      h2Counter++;
      h3Counter = 0;
      const text = h2Match[2].trim();
      if (!/^\d+\.\s/.test(text)) {
        out.push("## " + h2Counter + ". " + text);
      } else {
        out.push(line);
      }
      continue;
    }

    const h3Match = line.match(/^(#{3})\s+(.+)$/);
    if (h3Match) {
      h3Counter++;
      const text = h3Match[2].trim();
      if (!/^\d+\.\d+\.\s/.test(text)) {
        out.push("### " + h2Counter + "." + h3Counter + " " + text);
      } else {
        out.push(line);
      }
      continue;
    }

    out.push(line);
  }

  return out.join('\n');
}

function normalizeMarkdownBreaks(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  let inCode = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    out.push(line);
    if (line.trimStart().startsWith('```')) { inCode = !inCode; continue; }
    if (inCode) continue;

    // Only ensure blank line before block elements (headings, blockquotes, hr)
    const next = lines[i + 1];
    if (next === undefined) break;
    if (line !== '' && next !== '' && !line.startsWith('```') && /^(#{1,6}\s|>|---|\*\*\*)/.test(next)) {
      out.push('');
    }
  }
  return out.join('\n');
}

function appendSeriesNavigation(content: string, input: ArticleGenInput): string {
  if (!input.seriesContext) return content;
  
  if (content.includes("**系列导航**") || content.includes("系列导航")) {
    return content;
  }
  
  const navLines: string[] = [];
  navLines.push('');
  navLines.push('---');
  navLines.push('**系列导航**');
  
  const prevMatch = input.seriesContext.match(/上一篇：\[(.+?)\]\(#article-(.+?)\)/);
  const nextMatch = input.seriesContext.match(/下一篇：\[(.+?)\]\(#article-(.+?)\)/);
  
  if (prevMatch) {
    navLines.push("上一篇：[" + prevMatch[1] + "](#article-" + prevMatch[2] + ")");
  }
  if (nextMatch) {
    navLines.push("下一篇：[" + nextMatch[1] + "](#article-" + nextMatch[2] + ")");
  }
  
  if (navLines.length > 1) {
    return content + navLines.join('\n');
  }
  
  return content;
}
