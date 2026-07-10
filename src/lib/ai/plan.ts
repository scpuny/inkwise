// plan.ts — AI 文章规划与生成
// 使用 agentEngine 的 tool calling 模式获取项目文件上下文
import { sendChat, sendChatStream, type ChatMessage } from "./ai";
import { resolveProviderForModel } from "../config/globalAIConfig";
import { runAgentLoop, PROJECT_TOOLS, type ProjectToolContext } from "./agent/engine";
import { isTauriEnv } from "../bridge/tauri";
import { getEffectivePhaseConfig, loadCustomSkills, getBuiltinSkills, type WritingSkill } from "../ai/writingSkill";
import type { OutlineSection } from "./article/blueprint";

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
  /** Series context — passed through from series plan */
  seriesContext?: string;
  seriesId?: string;
  /** Explicit collectionId to avoid race condition with activeCollectionId store */
  planCollectionId?: string;
}

export type PlanStep = "idle" | "title" | "description" | "outline" | "tags" | "explored" | "stage1-done" | "done";
export type PlanStepResult = { step: PlanStep; data: any };

export interface ArticleGenInput {
  title: string;
  description: string;
  outline: OutlineSection[];
  tone?: string;
  targetAudience?: string;
  targetWordCount?: number;
  skillId?: string;
  /** 写作风格 ID（v2.1.0 新增，使初稿即可感知风格） */
  styleId?: string;
  /** 写作动作 ID（v2.1.0 新增） */
  actionId?: string;
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
  styleId?: string;
  actionId?: string;
  totalSections?: number;
  previousSectionTitle?: string;
  previousSectionContent?: string;
  /** linked folder path: enables tool-based file reading */
  linkedFolder?: string;
}

// ─── Skill helpers ───

let _allSkillsCache: WritingSkill[] | null = null;

async function ensureAllSkillsCache(): Promise<void> {
  if (_allSkillsCache !== null) return;
  const all = new Map<string, WritingSkill>();
  // Builtin skills
  getBuiltinSkills().forEach(s => all.set(s.id, s));
  // Custom skills from localStorage
  try {
    const customs = await loadCustomSkills();
    customs.forEach(s => all.set(s.id, s));
  } catch {}
  // Unified skills via IPC (Rust backend)
  if (isTauriEnv()) {
    try {
      const { getUnifiedSkills } = await import("../ai/skill/unified");
      const unified = await getUnifiedSkills();
      const ids = ["general","academic","blog","creative","viral","tutorial","business","news","marketing","product-doc","review"];
      unified.filter(s => s.phaseConfigs.length > 0).forEach((s, i) => {
        const legacy: WritingSkill = {
          id: ids[i] || s.name,
          name: s.name,
          description: s.description,
          icon: s.icon,
          scope: "full" as const,
          configs: Object.fromEntries(s.phaseConfigs.map(pc => [pc.phase, {
            systemPrompt: pc.systemPrompt,
            temperature: pc.temperature,
            model: pc.model,
            maxTokens: pc.maxTokens,
          }])),
          contextSources: [],
          dimensions: [],
          builtin: true,
          createdAt: 0,
          updatedAt: 0,
        };
        all.set(legacy.id, legacy);
      });
    } catch {}
  }
  _allSkillsCache = Array.from(all.values());
}

export function clearSkillCache(): void {
  _allSkillsCache = null;
}

async function resolveSkill(skillId?: string): Promise<WritingSkill | undefined> {
  await ensureAllSkillsCache();
  if (!skillId) {
    // Return the default "general" skill when no skill is selected
    // This ensures the system prompt contains correct writing instructions
    const general = _allSkillsCache?.find(s => s.id === "general");
    if (general) return general;
    // Fallback: first available builtin skill
    const builtins = getBuiltinSkills();
    return builtins.find(s => s.id === "general") || builtins[0];
  }
  const found = _allSkillsCache?.find(s => s.id === skillId);
  if (found) return found;
  // If specific skill not found, fall back to general
  return _allSkillsCache?.find(s => s.id === "general");
}

// ─── Provider ───

function getProvider() {
  return resolveProviderForModel().provider;
}



// ─── Prompt builders ───

function buildSystemPrompt(
  phase: string,
  skill: WritingSkill | undefined,
  tone?: string,
  styleId?: string,
  actionId?: string,
): string {
  const config = getEffectivePhaseConfig(skill, phase as any);
  let prompt = "直接输出所需内容，不要输出任何思考过程。\n\n" + config.systemPrompt;

  if (tone && tone.trim()) {
    prompt = "整体基调：" + tone + "。\n\n" + prompt;
  }

  // 注入风格/动作描述（v2.1.0）
  if (styleId || actionId) {
    const styleCtx: string[] = [];
    if (styleId) {
      styleCtx.push(`## 当前写作风格\n本文应遵循「${styleId}」风格的写作规范。`);
    }
    if (actionId) {
      styleCtx.push(`## 当前写作动作\n当前阶段为「${actionId}」，请据此调整内容的详略和侧重点。`);
    }
    if (styleCtx.length > 0) {
      prompt = styleCtx.join("\n\n") + "\n\n" + prompt;
    }
  }

  // 所有阶段通用：中文输出约束
  prompt += "\n\n## 输出语言\n- 使用流畅自然的中文，禁止混用英文或其他语言。所有内容必须为中文。";

  return prompt;
}

// ─── Tool-based article generation (via AgentEngine) ───

const ARTICLE_WRITER_SYSTEM_PROMPT = "直接输出文章，不要输出任何思考过程或额外说明。\n\n你是一位资深技术文章写作者。你的任务是为给定的项目写一篇高质量的技术文章。\n\n## 可用工具\n你可以在写作过程中随时使用以下工具来获取项目文件内容：\n- `read_project_files`: 读取项目源代码文件，获取真实的代码示例\n- `list_project_files`: 查看项目目录结构\n- `search_project_files`: 搜索文件名匹配的文件\n\n## 写作原则\n1. 所有代码示例必须直接从项目中读取真实代码，不要自己编造\n2. 文章中的代码块应是项目中实际存在的文件内容\n3. 在引用代码前，先用 `read_project_files` 读取对应文件\n4. 如果需要了解项目结构，用 `list_project_files` 查看目录\n5. 如果不确定某个功能在哪个文件中，用 `search_project_files` 搜索\n\n## 开篇要求\n- **开头必须用一段简短的前置描述或引言（不要直接进入正题）**，交代文章背景和读者预期，自然引出正文\n- 前置描述后立即用具体场景、反差或问题切入，避免\"大家好\"\"欢迎回到\"等冗余开场白\n\n## 行文规范\n- 受众是两类读者：技术开发者和有技术背景的创作者，为两者都提供价值\n- 段落控制 3-5 行，适配手机阅读；长短段交替\n- 整体调性统一：技术部分专业严谨，非技术部分简洁平实，不要混搭口语与硬核术语\n- 超长复合句拆成短句，避免同一个观点反复说\n\n## 技术内容准则\n- 贴代码时在代码上方用一句话说明这段代码的作用\n- 结构体/接口定义下方用注释解释每个字段的用途\n- 复杂概念用通俗类比降低理解成本\n- 涉及业务逻辑链路时，给出文本流程图（用 -> 连接）\n- 对易混淆概念做对比说明\n\n## 产品价值\n- 在结语前留一段对比分析：当前方案与市面上通用方案的核心差异\n- 突出本地优先、隐私安全、细粒度控制等差异化卖点\n- 结语简要预告下篇内容\n\n## 输出要求\n- 直接输出 Markdown 格式的完整文章\n- 文章标题已为 #（一级），标题后必须用一段简短的前置描述或引言（不要直接进入正题）\n- 所有二级标题（##）按出现顺序标号：`## 1. 标题`、`## 2. 标题`\n- 三级标题（###）在其父级下按顺序标号：`### 1.1 子标题`、`### 1.2 子标题`\n- 使用流畅自然的中文";

/**
 * 使用 AgentEngine（tool calling）生成完整文章。
 * AI 主动通过工具读取项目文件，确保代码真实性。
 */


// Tool execution instructions appended to skill-based system prompts
const TOOL_INSTRUCTIONS = `

## 核心原则（重要）
1. **本文必须围绕关联的真实项目展开** — 项目结构和上下文信息已在用户消息中提供，所有内容必须基于真实项目
2. **在写作前必须先读取项目的关键文件**，了解项目的真实功能和架构
3. **禁止编造不存在的能力或功能特性** — 所有描述的功能、API、特性必须能在项目代码中找到真实依据
4. **禁止编造 API 路径、接口名称、配置项等** — 必须从项目代码中读取真实的命名和结构

## 可用工具
你必须使用以下工具来获取项目真实文件内容：
- \`read_project_files\`: 读取项目源代码文件，获取真实的代码示例
- \`list_project_files\`: 查看项目目录结构
- \`search_project_files\`: 搜索文件名匹配的文件

## 写作原则
1. 所有代码示例必须直接从项目中读取真实代码，不要自己编造
2. 文章中的代码块应是项目中实际存在的文件内容
3. 在引用代码前，先用 \`read_project_files\` 读取对应文件
4. 如果需要了解项目结构，用 \`list_project_files\` 查看目录
5. 如果不确定某个功能在哪个文件中，用 \`search_project_files\` 搜索

## 输出要求
- 直接输出 Markdown 格式的完整文章
- 文章标题已为 #（一级），标题后必须用一段简短的前置描述或引言（不要直接进入正题）
- 所有二级标题（##）按出现顺序标号：\`## 1. 标题\`、\`## 2. 标题\`
- 三级标题（###）在其父级下按顺序标号：\`### 1.1 子标题\`、\`### 1.2 子标题\`
- 使用流畅自然的中文`;

export async function generateFullArticleWithTools(
  input: ArticleGenInput,
  onToken?: (token: string) => void,
  onToolEvent?: (event: import("./agent/engine").ToolEvent) => void,
): Promise<string> {
  const { provider, model } = resolveProviderForModel();
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
  if (input.styleId) parts.push("写作风格：" + input.styleId);
  if (input.actionId) parts.push("写作动作：" + input.actionId);
  if (input.targetAudience) parts.push("目标读者：" + input.targetAudience);
  if (input.targetWordCount) parts.push("目标字数：约 " + input.targetWordCount + " 字");

  // Include project structure context so AI doesn't need to re-explore
  if (input.projectContext) {
    parts.push("");
    parts.push("## 关联项目结构（重要）");
    parts.push("以上文章必须基于以下真实项目来撰写。这是项目的目录结构和关键文件索引，**不要写不属于此项目的内容**。");
    parts.push("```");
    parts.push(String(input.projectContext || "").slice(0, 8000));
    parts.push("```");
    parts.push("");
    parts.push("在开始写作前，请先使用 list_project_files 或 read_project_files 工具了解此项目的真实功能。");
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

  // Resolve skill and build system prompt from skill's writing phase config
  const writingSkill = input.skillId ? await resolveSkill(input.skillId) : await resolveSkill(undefined);
  const baseSystemPrompt = buildSystemPrompt("writing", writingSkill, input.tone, input.styleId, input.actionId);
  // Merge skill-specific instructions with tool-based writing instructions  
  const mergedSystemPrompt = baseSystemPrompt + TOOL_INSTRUCTIONS;

  try {
    const result = await runAgentLoop({
      systemPrompt: mergedSystemPrompt,
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
  onToolEvent?: (event: import("./agent/engine").ToolEvent) => void,
): Promise<string> {
  const { provider, model } = resolveProviderForModel();
  if (!provider) {
    throw new Error("请先在设置中配置 AI 提供商");
  }

  const skill = await resolveSkill(input.skillId);
  const systemPrompt = buildSystemPrompt("writing", skill, input.tone, input.styleId, input.actionId);

  // Build user message
  const lines: string[] = [];
  lines.push("请根据以下信息写一篇完整的文章：");
  lines.push("");
  lines.push("标题：" + input.title);
  if (input.description) lines.push("简介：" + input.description);
  if (input.tone) lines.push("风格：" + input.tone);
  if (input.styleId) lines.push("写作风格：" + input.styleId);
  if (input.actionId) lines.push("写作动作：" + input.actionId);
  if (input.targetAudience) lines.push("目标读者：" + input.targetAudience);
  if (input.targetWordCount) lines.push("目标字数：约 " + input.targetWordCount + " 字");

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
        model,
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

export async function* generatePlanStream(input: PlanInput, stage1?: boolean): AsyncGenerator<PlanStepResult> {
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

  // Stage 1: stop here for new documents — let user review title+description
  if (stage1) {
    yield { step: "stage1-done", data: null };
    return;
  }

  // Generate outline
  const outline = await generateOutline(enriched, title, description);
  yield { step: "outline", data: outline };

  // Generate tags
  const tags = await generateTags(input, title, description);
  yield { step: "tags", data: tags };

  yield { step: "done", data: null };
}

/**
 * Phase 2: generate outline + tags from confirmed title+description.
 */
export async function* generatePlanStage2(
  input: PlanInput,
  title: string,
  description: string,
): AsyncGenerator<PlanStepResult> {
  const enriched = input.projectContext
    ? { ...input, projectContext: input.projectContext }
    : input;

  const outline = await generateOutline(enriched, title, description);
  yield { step: "outline", data: outline };

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
  const skill = await resolveSkill(input.skillId);
  const config = getEffectivePhaseConfig(skill, "title");
  let sysPrompt = config.systemPrompt;

  if (input.tone && input.tone.trim()) {
    sysPrompt = "整体基调：" + input.tone + "。\n\n" + sysPrompt;
  }
  // 抑制思考链 + 输出语言约束（这些函数不经过 buildSystemPrompt）
  sysPrompt = "直接输出所需内容，不要输出任何思考过程。\n\n" + sysPrompt + "\n\n## 输出语言\n- 使用流畅自然的中文。";

  const ctxBlock = input.projectContext ? buildProjectContextBlockForPlan(input.projectContext, input.projectName) : "";
  const userPrompt = [
    "请根据以下信息生成标题：",
    "",
    "灵感：" + input.inspiration,
    input.articleDescription ? "文章定位：" + input.articleDescription : "",
    input.targetAudience ? "目标读者：" + input.targetAudience : "",
    ctxBlock,
    input.seriesContext ? "系列上下文：\n" + input.seriesContext : "",
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt, 256);
  const cleaned = result.trim().replace(/^["']|["']$/g, "").trim();
  // Fallback: use first 40 chars of inspiration if AI returns empty
  return cleaned || (input.inspiration ? input.inspiration.slice(0, 40) : "无标题");
}

export async function generateDescription(input: PlanInput, title: string): Promise<string> {
  const skill = await resolveSkill(input.skillId);
  const config = getEffectivePhaseConfig(skill, "description");
  let sysPrompt = config.systemPrompt;

  if (input.tone && input.tone.trim()) {
    sysPrompt = "整体基调：" + input.tone + "。\n\n" + sysPrompt;
  }
  // 抑制思考链 + 输出语言约束（这些函数不经过 buildSystemPrompt）
  sysPrompt = "直接输出所需内容，不要输出任何思考过程。\n\n" + sysPrompt + "\n\n## 输出语言\n- 使用流畅自然的中文。";

  const ctxBlock = input.projectContext ? buildProjectContextBlockForPlan(input.projectContext, input.projectName) : "";
  const userPrompt = [
    "请根据以下信息生成文章简介（一句话概括）：",
    "",
    input.projectName ? "关联项目：" + input.projectName : "",
    "灵感：" + input.inspiration,
    "标题：" + title,
    input.articleDescription ? "文章定位：" + input.articleDescription : "",
    ctxBlock,
    input.seriesContext ? "系列上下文：\n" + input.seriesContext : "",
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt, 512);
  return result.trim().replace(/^["']|["']$/g, "").trim();
}

export async function generateOutline(input: PlanInput, title: string, description: string): Promise<OutlineSection[]> {
  const outlineSkill = await resolveSkill(input.skillId);
  const sysPrompt = buildSystemPrompt("outline", outlineSkill, input.tone);
  const userPrompt = [
    "请根据以下信息生成文章大纲。直接输出大纲，不要输出思考过程。",
    "",
    "## 格式要求（严格遵循）",
    "每条大纲必须包含**序号、标题和描述**：",
    "",
    "## 1. 标题 —— 描述",
    "### 1.1 子标题 —— 子标题描述",
    "### 1.2 子标题 —— 子标题描述",
    "## 2. 标题 —— 描述",
    "### 2.1 子标题 —— 子标题描述",
    "",
    "规则：",
    "- 一级章节用 ## 开头，二级子章节用 ### 开头 — 必须用 Markdown 标题标记",
    "- 每个大纲项必须包含序号（1. 2. 3. 或 1.1 2.1 等），序号后跟标题",
    "- 必须用中文破折号 —— 分隔标题和描述",
    "- 至少 3-5 个一级章节，每个一级章节下至少 2-3 个子章节",
    "- 每项描述必须给出（10-20 字），不能省略",
    "- 只输出大纲内容，Markdown 格式，不要加任何前言后语",
    "",
    input.projectName ? "关联项目：" + input.projectName : "",
    "灵感：" + input.inspiration,
    "标题：" + title,
    "简介：" + description,
    input.tone ? "风格：" + input.tone : "",
    input.targetAudience ? "目标读者：" + input.targetAudience : "",
    input.articleDescription ? "文章定位：" + input.articleDescription : "",
    input.seriesContext ? "系列上下文：\n" + input.seriesContext : "",
  ].filter(Boolean).join("\n");

  const result = await askAI(sysPrompt, userPrompt, 3072);
  if (!result || !result.trim()) {
    console.warn("[generateOutline] AI returned empty result, using fallback");
    return [
      { id: "sec_fallback_" + Date.now() + "_1", title: "引言", level: 1, description: "用真实场景或问题切入，引出文章主题，制造认知落差，让读者产生好奇心", status: "pending" },
      { id: "sec_fallback_" + Date.now() + "_2", title: "核心概念与原理", level: 1, description: "深入讲解文章涉及的核心概念、工作原理和关键机制，建立完整知识框架", status: "pending" },
      { id: "sec_fallback_" + Date.now() + "_3", title: "实践与应用", level: 1, description: "通过实际案例或代码示例展示如何应用所学知识，提供可操作的方法", status: "pending" },
      { id: "sec_fallback_" + Date.now() + "_4", title: "总结与对比", level: 1, description: "总结全文核心观点，与市面方案做对比分析，突出差异化价值和展望", status: "pending" },
    ];
  }
  console.log("[generateOutline] AI raw result first 500:", result.slice(0, 500));
  const parsed = parseOutline(result);
  if (parsed.length === 0) {
    console.warn("[generateOutline] parseOutline returned 0 sections, raw:", result.slice(0, 300));
  }
  return parsed.length > 0 ? parsed : [
    { id: "sec_fallback_" + Date.now() + "_1", title: "引言", level: 1, description: "用真实场景或问题切入，引出文章主题，制造认知落差", status: "pending" },
    { id: "sec_fallback_" + Date.now() + "_2", title: "核心概念与原理", level: 1, description: "深入讲解核心概念、工作原理和关键机制", status: "pending" },
    { id: "sec_fallback_" + Date.now() + "_3", title: "实践与应用", level: 1, description: "通过案例或代码示例展示如何应用所学知识", status: "pending" },
    { id: "sec_fallback_" + Date.now() + "_4", title: "总结与对比", level: 1, description: "总结全文，与市面方案对比分析，突出差异化价值", status: "pending" },
  ];
}

export async function generateTags(input: PlanInput, title: string, description: string): Promise<string[]> {
  const tagsSkill = await resolveSkill(input.skillId);
  const sysPrompt = buildSystemPrompt("tags", tagsSkill, input.tone);
  const userPrompt = [
    "灵感：" + input.inspiration,
    "标题：" + title,
    "简介：" + description,
    input.targetAudience ? "目标读者：" + input.targetAudience : "",
    input.seriesContext ? "系列上下文：\n" + input.seriesContext : "",
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
  const { provider, model } = resolveProviderForModel();
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");

  const skill = await resolveSkill(input.skillId);
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
  const { provider, model } = resolveProviderForModel();
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");

  const skill = await resolveSkill(input.skillId);
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
      model,
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

async function askAI(systemPrompt: string, userPrompt: string, maxTokens?: number): Promise<string> {
  const { provider, model } = resolveProviderForModel();
  if (!provider) throw new Error("请先在设置中配置 AI 提供商");

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  try {
    return await sendChat({
      providerId: provider.id,
      model,
      messages,
      temperature: 0.7,
      maxTokens: maxTokens ?? 1024,
    });
  } catch (e) {
    console.error("[askAI] Non-streaming chat failed, falling back to streaming:", e);
    // Fallback: use streaming (collect full result)
    return sendChatStream({
      providerId: provider.id,
      model,
      messages,
      temperature: 0.7,
      maxTokens: maxTokens ?? 1024,
    });
  }
}

function parseOutline(text: string): OutlineSection[] {
  const sections: OutlineSection[] = [];
  const lines = text.trim().split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let title = "";
    let description = "";
    let level: 1 | 2 | 3 = 1;
    let match = null;

    // Pattern 1: "## 1. Title —— Desc" or "### 1.1 Title —— Desc" (markdown heading with number)
    match = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      level = (match[1].length <= 2 ? 1 : match[1].length === 3 ? 2 : 3) as 1 | 2 | 3;
      let rest = match[2].trim();
      // Strip leading number like "1. ", "1.1 ", "1.1.1 "
      rest = rest.replace(/^\d+(\.\d+)*\s*[.、]?\s*/, "");
      const descMatch = rest.match(/^(.+?)\s*(?:[-—]{1,2}|：)\s*(.+)$/);
      if (descMatch) {
        title = descMatch[1].trim();
        description = descMatch[2].trim();
      } else {
        title = rest;
      }
    }

    // Pattern 2: "1.1.1 Title — Desc" (numbered with dots, level inferred from dot count)
    if (!match) {
      match = trimmed.match(/^(\d+)\.(\d+)(?:\.(\d+))?\s+(.+?)(?:\s*(?:[-—]{1,2}|：)\s*(.+))?$/);
      if (match) {
        // 2-part number (1.1) => level 2, 3-part number (1.1.1) => level 3
        level = match[3] ? 3 : 2;
        title = match[4].trim();
        description = (match[5]?.trim() || "");
      }
    }

    // Pattern 3: "1. Title —— Desc" or "1、Title——Desc" (single numbered)
    if (!match) {
      match = trimmed.match(/^(\d+)[.、]\s*(.+?)(?:\s*(?:[-—]{1,2}|：)\s*(.+))?$/);
      if (match) {
        title = match[2].trim();
        description = (match[3]?.trim() || "");
      }
    }

    // Pattern 4: "1) Title —— Desc" (parenthetical number)
    if (!match) {
      match = trimmed.match(/^(\d+)\)\s*(.+?)(?:\s*(?:[-—]{1,2}|：)\s*(.+))?$/);
      if (match) {
        title = match[2].trim();
        description = (match[3]?.trim() || "");
      }
    }

    // Pattern 5: "- Title —— Desc" or "* Title —— Desc" (bullet)
    if (!match) {
      match = trimmed.match(/^[-*]\s+(.+?)(?:\s*(?:[-—]{1,2}|：)\s*(.+))?$/);
      if (match) {
        title = match[1].trim();
        description = (match[2]?.trim() || "");
      }
    }

    // Pattern 6: Plain title line — only if short (likely a title, not paragraph)
    if (!match && trimmed.length < 100 && !trimmed.endsWith("。") && !trimmed.endsWith(".") && !trimmed.endsWith("！") && !trimmed.endsWith("？")) {
      const descMatch = trimmed.match(/^(.+?)\s*[-—]{1,2}\s*(.+)$/);
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
    { id: "sec_plan_" + Date.now() + "_1", title: "引言", level: 1, description: "从具体场景或问题切入，引出主题，制造认知落差，让读者产生好奇", status: "pending" },
    { id: "sec_plan_" + Date.now() + "_2", title: "核心概念与原理", level: 1, description: "深入讲解核心概念和工作原理，建立完整的知识框架", status: "pending" },
    { id: "sec_plan_" + Date.now() + "_3", title: "实践与应用", level: 1, description: "通过案例或代码示例展示如何应用，提供可操作的方法", status: "pending" },
    { id: "sec_plan_" + Date.now() + "_4", title: "总结与展望", level: 1, description: "总结全文要点，对比市面方案，突出差异化并展望未来", status: "pending" },
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

    // h1 — article title, pass through without numbering (but reset lower counters)
    const h1Match = line.match(/^(#{1})\s+(.+)$/);
    if (h1Match) {
      h2Counter = 0;
      h3Counter = 0;
      out.push(line);
      continue;
    }

    const h2Match = line.match(/^(#{2})\s+(.+)$/);
    if (h2Match) {
      h2Counter++;
      h3Counter = 0;
      // 强制重编号：去掉AI生成的编号前缀，从1开始重新编号
      const text = h2Match[2].trim().replace(/^\d+\.\s*/, '');
      out.push('## ' + h2Counter + '. ' + text);
      continue;
    }

    const h3Match = line.match(/^(#{3})\s+(.+)$/);
    if (h3Match) {
      h3Counter++;
      // 强制重编号：去掉已有的 x.x. 前缀，重新编号
      const text = h3Match[2].trim().replace(/^\d+\.\d+\.\s*/, '');
      // 修复：如果前面没有 h2 父级，使用简单顺序编号（避免 0.x）
      out.push('### ' + (h2Counter > 0 ? h2Counter + '.' + h3Counter : h3Counter) + ' ' + text);
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
