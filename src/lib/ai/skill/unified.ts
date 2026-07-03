/* ═══════════════════════════════════════════════════
   unifiedSkills.ts — 统一技能列表（前端适配层）
   既是 Rust unified_builtin_skills() 的 TypeScript 镜像，
   也在浏览器模式下滑为本地定义。
   ═══════════════════════════════════════════════════ */

import type { UnifiedSkill, ToolCapability, SkillPhase, RunAs, SkillScope, EffortLevel, SkillContextSource } from "./types";
import { tryInvoke, isTauriEnv, TauriCommands } from "../../bridge/tauri";

/* ─── Builder 辅助 ─── */

type PartialSkill = Omit<UnifiedSkill, "body" | "runAs" | "allowedTools" | "phaseConfigs" | "contextSources" | "scope" | "enabled"> & {
  body?: string;
  runAs?: RunAs;
  allowedTools?: ToolCapability[];
  phaseConfigs?: Array<{ phase: SkillPhase; systemPrompt: string; temperature?: number; model?: string; maxTokens?: number }>;
  contextSources?: SkillContextSource[];
  model?: string;
  effort?: EffortLevel;
  scope?: SkillScope;
  enabled?: boolean;
};

function u(skill: PartialSkill): UnifiedSkill {
  return {
    body: "",
    runAs: "inline",
    allowedTools: [],
    phaseConfigs: [],
    contextSources: [],
    scope: "builtin",
    enabled: true,
    ...skill,
  } as UnifiedSkill;
}

/* ─── 内置统一技能列表（浏览器模式降级） ─── */

const BUILTIN_UNIFIED_SKILLS: UnifiedSkill[] = [
  // ── 风格型（源自前端 getBuiltinSkills） ──
  u({
    name: "general", description: "通用写作", icon: "📝",
    body: "你是一位专业写作者。根据用户要求完成写作任务，保持文风自然得体。",
    runAs: "subagent",
    allowedTools: ["read_document", "write_document"],
    phaseConfigs: [
      { phase: "title", systemPrompt: "你是一位标题专家。生成简洁有力的标题。\n\n## 规则\n- 标题直接反映内容核心\n- 控制在 8-20 字\n- 直接输出，不要前缀和引号", temperature: 0.7 },
      { phase: "writing", systemPrompt: "以通用写作风格撰写内容。\n\n## 要求\n- 段落 3-5 行\n- 句式多样\n- 语气自然得体\n- 遵循 Markdown 格式", temperature: 0.7, maxTokens: 4096 },
    ],
  }),

  u({
    name: "academic", description: "学术严谨", icon: "🔬",
    body: "严谨、客观的学术写作风格。\n\n## 规则\n- 使用客观、中立的语气\n- 每个论点需有论据支撑\n- 避免主观评价和情感化表达",
    runAs: "subagent", effort: "high",
    allowedTools: ["read_document", "write_document", "search_document"],
    phaseConfigs: [
      { phase: "title", systemPrompt: "为研究论文生成严谨、准确的标题。\n\n## 规则\n- 标题直接反映研究内容\n- 使用规范学术术语\n- 10-25 字", temperature: 0.4 },
      { phase: "writing", systemPrompt: "撰写严谨、客观的学术内容。\n\n## 语言\n- 客观第三人称\n- 句子控制在 40 字以内\n\n## 格式\n- 标题从 ## 开始", temperature: 0.5, maxTokens: 4096 },
    ],
  }),

  u({
    name: "blog", description: "博客口语", icon: "📢",
    body: "轻松自然的博客风格。\n\n## 风格要求\n- 口语化但不随意\n- 段落短小精悍\n- 有明确的观点和态度",
    runAs: "subagent",
    allowedTools: ["read_document", "write_document"],
    phaseConfigs: [
      { phase: "title", systemPrompt: "为博客生成有「钩子」的标题。\n\n## 规则\n- 设问、反差、数字、具体收益\n- 10-22 字", temperature: 0.85 },
      { phase: "writing", systemPrompt: "以博客风格撰写。\n\n## 开篇\n- 用具体场景或个人经历切入\n\n## 语气\n- 用「你」拉近距离\n\n## 结构\n- 段落 3-5 行\n- 长短段交替", temperature: 0.8, maxTokens: 4096 },
    ],
  }),

  u({
    name: "creative", description: "创意写作", icon: "✨",
    body: "富有文学性和想象力的创作风格。\n\n## 规则\n- 使用文学性语言\n- 注重修辞手法\n- 增强画面感和感染力",
    runAs: "subagent",
    allowedTools: ["read_document", "write_document"],
    phaseConfigs: [
      { phase: "title", systemPrompt: "为文学作品生成诗意标题。\n\n## 规则\n- 有意境、有画面感\n- 4-15 字", temperature: 0.9 },
      { phase: "writing", systemPrompt: "以创意文学风格撰写。\n\n## 开篇\n- 从具体意象或场景切入\n\n## 语言\n- 注重节奏感\n- 善用比喻、拟人\n\n## 叙事\n- Show, don't tell", temperature: 0.9, maxTokens: 4096 },
    ],
  }),

  u({
    name: "viral", description: "社交流行", icon: "📱",
    body: "高传播性内容风格，适合社交媒体。\n\n## 要求\n- 信息密度高\n- 有态度、有情绪\n- 段落短小",
    runAs: "subagent",
    allowedTools: ["read_document", "write_document"],
    phaseConfigs: [
      { phase: "title", systemPrompt: "生成高传播标题。\n\n## 规则\n- 制造好奇缺口\n- 可使用数字、对比、反转\n- 10-26 字", temperature: 0.9 },
      { phase: "writing", systemPrompt: "以社交传播风格撰写。\n\n## 开头\n- 冲击性事实或反常识观点\n\n## 结构\n- 段落 2-4 行\n- 结尾引发评论或转发", temperature: 0.85, maxTokens: 4096 },
    ],
  }),

  u({
    name: "tutorial", description: "技术教程", icon: "💻",
    body: "清晰实用的技术教程风格。\n\n## 要求\n- 步骤式推进\n- 解释「为什么这样做」\n- 代码示例可运行",
    runAs: "subagent",
    allowedTools: ["read_document", "write_document"],
    contextSources: [{ sourceType: "project", label: "关联项目目录", required: false, maxTokens: 4000 } as SkillContextSource],
    phaseConfigs: [
      { phase: "title", systemPrompt: "为技术教程生成清晰标题。\n\n## 规则\n- 包含核心技术点\n- 8-22 字", temperature: 0.5 },
      { phase: "writing", systemPrompt: "以技术教程风格撰写。\n\n## 结构\n- 步骤式推进\n- 指出常见坑点\n\n## 代码\n- 代码块标注语言\n- 核心逻辑加注释", temperature: 0.6, maxTokens: 4096 },
    ],
  }),

  u({
    name: "business", description: "商业文案", icon: "📦",
    body: "有说服力的商业文案风格。\n\n## 要求\n- 突出价值主张\n- 用数据支撑观点\n- 有明确 CTA",
    runAs: "subagent",
    allowedTools: ["read_document", "write_document"],
    phaseConfigs: [
      { phase: "title", systemPrompt: "为商业内容生成有说服力的标题。\n\n## 规则\n- 突出价值主张\n- 10-22 字", temperature: 0.8 },
      { phase: "writing", systemPrompt: "以商业文案风格撰写。\n\n## 结构\n- 吸引→建立信任→说服→转化\n\n## 语言\n- 用数据、案例支撑\n\n## 结尾\n- 明确 CTA", temperature: 0.75, maxTokens: 4096 },
    ],
  }),

  u({
    name: "news", description: "新闻报道", icon: "📰",
    body: "客观中立的新闻报道风格。\n\n## 要求\n- 倒金字塔结构\n- 5W1H 覆盖\n- 客观陈述",
    runAs: "subagent",
    allowedTools: ["read_document", "write_document"],
    phaseConfigs: [
      { phase: "title", systemPrompt: "为新闻报道生成客观准确标题。\n\n## 规则\n- 主语+谓语+宾语直述结构\n- 10-22 字", temperature: 0.4 },
      { phase: "writing", systemPrompt: "以新闻报道风格撰写。\n\n## 结构\n- 倒金字塔结构\n- 最重要信息在最前面\n\n## 语言\n- 客观中立\n- 引用标明来源", temperature: 0.5, maxTokens: 4096 },
    ],
  }),

  u({
    name: "marketing", description: "营销文案", icon: "🎯",
    body: "有转化力的营销文案风格。\n\n## 要求\n- 突出核心卖点\n- 激发欲望\n- 降低决策门槛",
    runAs: "subagent",
    allowedTools: ["read_document", "write_document"],
    phaseConfigs: [
      { phase: "title", systemPrompt: "为营销内容生成高转化标题。\n\n## 规则\n- 突出核心卖点和用户利益\n- 8-18 字", temperature: 0.85 },
      { phase: "writing", systemPrompt: "以营销文案风格撰写。\n\n## 结构\n- 吸引注意→激发兴趣→建立信任→促成行动\n\n## 语言\n- 用「你」拉近距离\n\n## 结尾\n- 明确 CTA", temperature: 0.75, maxTokens: 4096 },
    ],
  }),

  u({
    name: "product-doc", description: "产品文档", icon: "📖",
    body: "清晰准确的产品文档风格。\n\n## 要求\n- 客观准确\n- 步骤式操作说明\n- 规范的术语",
    runAs: "subagent",
    allowedTools: ["read_document", "write_document"],
    contextSources: [{ sourceType: "project", label: "关联项目目录", required: false, maxTokens: 4000 } as SkillContextSource],
    phaseConfigs: [
      { phase: "title", systemPrompt: "为产品文档生成清晰标题。\n\n## 规则\n- 直接反映文档内容\n- 6-18 字", temperature: 0.3 },
      { phase: "writing", systemPrompt: "以产品文档风格撰写。\n\n## 语气\n- 客观、准确、中立\n\n## 结构\n- 概述→快速开始→核心概念→操作指南\n\n## 格式\n- 代码块标注语言\n- 表格用于参数说明", temperature: 0.3, maxTokens: 4096 },
    ],
  }),

  u({
    name: "review", description: "评论鉴赏", icon: "🎬",
    body: "有深度、有态度的评论风格。\n\n## 要求\n- 多维分析\n- 具体例证支撑",
    runAs: "subagent",
    allowedTools: ["read_document", "write_document"],
    phaseConfigs: [
      { phase: "title", systemPrompt: "为评论文章生成有态度的标题。\n\n## 规则\n- 体现核心观点或评价立场\n- 8-20 字", temperature: 0.8 },
      { phase: "writing", systemPrompt: "以评论风格撰写。\n\n## 开篇\n- 给出总体评价\n\n## 结构\n- 多维度分析\n- 具体例证支撑\n\n## 语言\n- 精准的鉴赏术语", temperature: 0.75, maxTokens: 4096 },
    ],
  }),

  // ── 动作型（源自 Rust builtin_skills） ──
  u({ name: "continue-writing", description: "续写", icon: "✍️", body: "从光标位置继续写作，保持文风和内容连贯。\n\n## 规则\n- 保持原文的语气和风格\n- 延续当前段落的主题\n- 自然过渡，不突兀", allowedTools: ["read_document", "write_document"] }),
  u({ name: "rewrite", description: "改写", icon: "🔄", body: "根据用户要求改写选中的文本。保持原意，提升表达质量。", allowedTools: ["read_document", "write_document"] }),
  u({ name: "polish", description: "润色", icon: "✨", body: "润色文本，修正语法问题，优化表达，保持原意和风格。", allowedTools: ["read_document"] }),
  u({ name: "translate", description: "翻译", icon: "🌐", body: "将文本翻译为目标语言。保持原意和文体风格。", allowedTools: ["read_document"] }),
  u({ name: "summary", description: "摘要", icon: "📋", body: "阅读文档内容，生成简洁准确的摘要。\n\n## 要求\n- 概括核心观点\n- 控制在原文 20% 长度以内", allowedTools: ["read_document"] }),
  u({ name: "outline", description: "大纲", icon: "📑", body: "阅读文档内容，生成或优化层级清晰的大纲结构。", allowedTools: ["read_document", "write_document"] }),
  u({ name: "expand", description: "扩写", icon: "📈", body: "对现有文本进行扩写，丰富内容和细节。\n\n## 规则\n- 保持原文的核心观点和语气\n- 补充具体论据", allowedTools: ["read_document", "write_document"] }),
  u({ name: "paraphrase", description: "同义改写", icon: "🔄", body: "保持原意不变，改变句式和措辞，生成改写版本。", allowedTools: ["read_document", "write_document"] }),
  u({ name: "proofread", description: "校对", icon: "✅", body: "检查文本中的语法错误、错别字和标点问题。", allowedTools: ["read_document"] }),
  u({ name: "headline", description: "标题生成", icon: "🏷️", body: "根据文章内容生成多个高质量的标题。\n\n## 规则\n- 每个标题控制在 10-25 字\n- 提供不同风格", allowedTools: ["read_document"] }),
  u({ name: "email", description: "邮件写作", icon: "📧", body: "根据场景和收件人撰写不同风格的邮件。\n\n## 风格选项\n- 正式、半正式、非正式", allowedTools: ["read_document", "write_document"] }),
  u({ name: "keyword-extract", description: "关键词提取", icon: "🔑", body: "分析文档内容，提取核心关键词和标签。", allowedTools: ["read_document"] }),
  u({ name: "readability", description: "可读性优化", icon: "📊", body: "分析文本的可读性，提供具体改进建议。\n\n## 评估维度\n- 句子长度、段落长度、词汇难度", allowedTools: ["read_document"] }),
  u({ name: "citation", description: "引用格式", icon: "📚", body: "根据文献信息，生成规范的引用格式。\n\n## 支持的格式\n- APA、MLA、GB/T 7714", allowedTools: ["read_document"] }),

  // ── 项目感知型技能（Project-Aware Skills） ──
  u({
    name: "project-changelog", description: "项目变动报告", icon: "📋",
    body: "根据项目 Git 变更 / 文件变更生成清晰的项目变动报告。\n\n## 报告结构\n1. 变更概览（修改文件数、增删行数、涉及模块）\n2. 关键变更详解（每个文件/函数的具体改动）\n3. 影响分析（变更波及了哪些上下游模块）\n4. 风险提示（高复杂度区域变更）\n5. 建议下一步",
    runAs: "subagent", effort: "high",
    allowedTools: ["read_document", "write_document", "git_diff", "read_project_files", "list_project_files"],
    contextSources: [{ sourceType: "project", label: "关联项目目录", required: true, maxTokens: 4000 }],
  }),
  u({
    name: "project-intro", description: "项目导读", icon: "🗺️",
    body: "根据项目结构生成项目导读，适合新人快速了解项目。\n\n## 内容\n1. 一句话概括项目定位\n2. 技术栈一览（语言、框架、数据库、构建工具）\n3. 核心模块与目录职责（每个一级目录一句话说明）\n4. 关键入口文件说明\n5. 常见开发流程\n6. 代码组织规范",
    runAs: "subagent", effort: "medium",
    allowedTools: ["read_document", "write_document", "read_project_files", "list_project_files"],
    contextSources: [{ sourceType: "project", label: "关联项目目录", required: true, maxTokens: 4000 }],
  }),
  u({
    name: "impact-analysis", description: "变更影响评估", icon: "🔍",
    body: "分析代码变更的影响范围，识别可能受影响的模块。\n\n## 输出\n1. 变更核心（改了哪里、改了什么）\n2. 直接影响（同一模块内依赖它的函数/类）\n3. 间接影响（其他模块调用受影响函数的地方）\n4. 风险评分（低/中/高）+ 原因\n5. 测试建议",
    runAs: "subagent", effort: "high",
    allowedTools: ["read_document", "write_document", "git_diff", "read_project_files", "list_project_files", "search_project_files"],
    contextSources: [{ sourceType: "project", label: "关联项目目录", required: true, maxTokens: 4000 }],
  }),
];

/* ─── 运行时获取统一技能列表 ─── */

let cachedSkills: UnifiedSkill[] | null = null;

/** 获取统一技能列表：优先从 Rust 获取，Tauri 不可用时降级本地 */
export async function getUnifiedSkills(): Promise<UnifiedSkill[]> {
  if (cachedSkills) return cachedSkills;

  if (isTauriEnv()) {
    try {
      const skills = await tryInvoke<UnifiedSkill[]>(TauriCommands.ListUnifiedSkills);
      if (skills && skills.length > 0) {
        cachedSkills = skills;
        return skills;
      }
    } catch {
      // fallback to local
    }
  }

  cachedSkills = BUILTIN_UNIFIED_SKILLS;
  return cachedSkills;
}

/** 按 name 查找统一技能 */
export async function findUnifiedSkill(name: string): Promise<UnifiedSkill | undefined> {
  const skills = await getUnifiedSkills();
  return skills.find((s) => s.name === name);
}

/** 按作用域分类 */
export async function getSkillsByScope(scope: SkillScope): Promise<UnifiedSkill[]> {
  const skills = await getUnifiedSkills();
  return skills.filter((s) => s.scope === scope);
}

/** 获取内置风格型技能（含 phaseConfigs） */
export async function getStyleSkills(): Promise<UnifiedSkill[]> {
  const skills = await getUnifiedSkills();
  return skills.filter((s) => s.phaseConfigs.length > 0);
}

/** 获取动作型技能（仅 body） */
export async function getActionSkills(): Promise<UnifiedSkill[]> {
  const skills = await getUnifiedSkills();
  return skills.filter((s) => s.phaseConfigs.length === 0);
}

/** 清空缓存（用于 Tauri 热更新） */
export function clearSkillCache(): void {
  cachedSkills = null;
}
