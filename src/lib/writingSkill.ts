// writingSkill.ts — 写作技能：从灵感录入到文章完成的风格控制
// 设计文档: docs/WRITING-SKILL-DESIGN.md
// Phase 1: 类型定义 + 内置预设

/* ─── 基础类型 ─── */

/** 技能作用范围 */
export type SkillScope = "full" | "phase";

/** 可独立配置的阶段 */
export type SkillPhase = "title" | "description" | "outline" | "tags" | "writing";

/** 上下文来源声明 */
export interface ContextSource {
  type: "project" | "series" | "linked_folder" | "custom_text";
  label: string;
  required: boolean;
  maxLength?: number;
}

/** 单个阶段的 AI 配置 */
export interface PhaseConfig {
  systemPrompt: string;
  temperature?: number;
  model?: string;
  maxTokens?: number;
}

/** 工具调用声明（未来扩展） */
export interface ToolDeclaration {
  name: string;
  description: string;
}

/** 风格维度标签（0-10） */
export interface StyleDimension {
  name: string;
  value: number;
}

/* ─── 核心模型 ─── */

export interface WritingSkill {
  id: string;
  name: string;
  description: string;
  icon: string;

  /** 作用范围 */
  scope: SkillScope;
  /** phase 模式下指定目标阶段 */
  phase?: SkillPhase;

  /** 各阶段配置 */
  configs: Partial<Record<SkillPhase, PhaseConfig>>;

  /** 上下文来源声明 */
  contextSources: ContextSource[];

  /** 工具调用（未来） */
  tools?: ToolDeclaration[];

  /** 风格维度标签 */
  dimensions: StyleDimension[];

  /** 示例文本 */
  exampleText?: string;

  /** 是否为内置 */
  builtin: boolean;
  createdAt: number;
  updatedAt: number;
}

/* ─── 默认 fallback prompt ─── */

export const DEFAULT_TITLE_PROMPT =
`你是一位标题创作专家。根据用户的灵感和偏好，生成一个吸引人的文章标题。

## 规则
- 标题要准确反映内容
- 控制在 8-25 字
- 直接输出标题，不要有任何前缀、引号或额外文字
- 只输出一行，不要换行`;

export const DEFAULT_DESCRIPTION_PROMPT =
`你是一位专业的文章策划。根据文章的标题和灵感，写一句简洁有力的文章简介。

## 规则
- 一句话概括文章要表达的核心内容
- 30-80 字
- 直接输出简介，不要前缀和引号
- 只输出一行`;

export const DEFAULT_OUTLINE_PROMPT =
`你是一位写作规划师。为文章生成大纲结构。

## 输出格式
输出一个编号列表，每行一个章节。格式为：
1. 章节标题 - 章节描述
2. 章节标题 - 章节描述

## 规则
- 章节标题清晰准确
- 章节描述简要说明该章节要写什么
- 大纲逻辑递进，覆盖主题的各个方面
- 控制在 4-8 个章节`;

export const DEFAULT_TAGS_PROMPT =
`你是一位标签策略专家。为文章生成 3-6 个精准的标签。

## 规则
- 标签要覆盖文章的核心主题、风格和领域
- 每个标签 2-6 个字
- 直接输出标签，用空格分隔
- 只输出一行`;

export const DEFAULT_WRITING_PROMPT =
`你是一位资深中文写作者。根据文章规划和当前章节信息，撰写该章节的完整内容。

## 要求
- 仅输出章节正文内容，不要包含章节标题（外部会自动添加）
- 子章节（###）不要额外编号
- 段落之间用空行分隔，适当使用加粗、引用等 Markdown 格式增加可读性
- 内容要具体充实，有细节、例子或数据支撑，不要空洞的套话
- 根据目标字数决定段落数量和内容深度
- 如果提供了前节内容，保持文风和逻辑连贯
- 直接输出纯内容，不要任何标题、不要额外说明文字`;

/* ─── 默认技能配置 ─── */

export const DEFAULT_PHASE_CONFIGS: Record<SkillPhase, PhaseConfig> = {
  title:       { systemPrompt: DEFAULT_TITLE_PROMPT,       temperature: 0.7, maxTokens: 1024 },
  description: { systemPrompt: DEFAULT_DESCRIPTION_PROMPT, temperature: 0.7, maxTokens: 1024 },
  outline:     { systemPrompt: DEFAULT_OUTLINE_PROMPT,     temperature: 0.7, maxTokens: 2048 },
  tags:        { systemPrompt: DEFAULT_TAGS_PROMPT,        temperature: 0.7, maxTokens: 512 },
  writing:     { systemPrompt: DEFAULT_WRITING_PROMPT,     temperature: 0.7, maxTokens: 4096 },
};

/* ─── 内置预设 ─── */

function builtin(id: string, partial: Omit<WritingSkill, "id" | "builtin" | "createdAt" | "updatedAt">): WritingSkill {
  return {
    id,
    builtin: true,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  };
}

export function getBuiltinSkills(): WritingSkill[] {
  return [
    /* ── 1. 通用写作（默认） ── */
    builtin("general", {
      name: "通用写作",
      description: "平衡得体的通用写作风格，适合大多数场景",
      icon: "📝",
      scope: "full",
      configs: {},
      contextSources: [],
      dimensions: [
        { name: "正式度", value: 5 },
        { name: "修辞密度", value: 5 },
        { name: "叙事性", value: 5 },
      ],
    }),

    /* ── 2. 学术严谨 ── */
    builtin("academic", {
      name: "学术严谨",
      description: "严谨客观的学术写作风格，适合论文、研究报告等正式内容",
      icon: "🔬",
      scope: "full",
      configs: {
        title: {
          systemPrompt:
`你是一位学术标题专家。生成严谨、准确的标题。

## 规则
- 标题直接反映研究内容和核心结论
- 避免文学修辞和情绪化词汇
- 使用规范的学术术语
- 控制在 15-25 字
- 直接输出标题，不要前缀`,
          temperature: 0.4,
        },
        description: {
          systemPrompt:
`写一段简洁的学术摘要。

## 规则
- 概括研究目的、方法、主要发现
- 使用客观的第三人称
- 50-100 字
- 直接输出，不要前缀`,
          temperature: 0.4,
        },
        outline: {
          systemPrompt:
`为学术文章生成严谨的大纲结构。

## 输出格式
编号列表，每行一个章节。

## 规则
- 遵循：引言 → 理论基础/文献综述 → 方法 → 结果 → 讨论 → 结论
- 章节之间逻辑递进
- 控制在 5-8 个章节
- 每个章节附简要说明`,
          temperature: 0.4,
        },
        tags: {
          systemPrompt:
`为学术文章生成标签。

## 规则
- 覆盖研究领域、方法、关键词
- 使用规范的学术术语
- 3-6 个标签，用空格分隔
- 直接输出`,
          temperature: 0.4,
        },
        writing: {
          systemPrompt:
`你是一位学术写作专家。遵循以下规则撰写章节内容：

## 语气
- 使用客观、中立的第三人称
- 避免主观评价和情感化表达
- 不出现"我认为""我觉得"等主观措辞

## 论证
- 每个论点需有论据或数据支撑
- 逻辑严密，因果链条清晰
- 引用规范，数据来源明确

## 语言
- 使用规范的学术术语，定义清晰
- 句子结构完整、严谨
- 避免口语化表达、修辞问句、感叹号
- 段落结构：主题句 → 展开论述 → 小结/过渡

## 格式
- 仅输出正文内容
- 段落之间用空行分隔
- 直接输出，不要额外说明`,
          temperature: 0.5,
          maxTokens: 4096,
        },
      },
      contextSources: [],
      dimensions: [
        { name: "正式度", value: 9 },
        { name: "修辞密度", value: 3 },
        { name: "叙事性", value: 2 },
      ],
    }),

    /* ── 3. 博客口语 ── */
    builtin("blog", {
      name: "博客口语",
      description: "轻松自然的博客风格，适合技术博客、个人分享等场景",
      icon: "📢",
      scope: "full",
      configs: {
        title: {
          systemPrompt:
`为博客文章生成一个吸引人的标题。

## 规则
- 可以有趣、有态度，不必太正式
- 可使用设问、对比、反转等手法
- 控制在 10-22 字
- 直接输出标题`,
          temperature: 0.85,
        },
        description: {
          systemPrompt:
`写一句吸引人的博客简介。

## 规则
- 点出读者的痛点或兴趣点
- 暗示文章能带来什么价值
- 口语化，不要太正式
- 20-60 字
- 直接输出`,
          temperature: 0.8,
        },
        writing: {
          systemPrompt:
`以轻松自然的博客风格撰写内容。

## 语气
- 口语化但不随意，保持可读性
- 像在和朋友聊天，但内容有干货
- 有明确的观点和态度

## 段落
- 段落短小精悍，3-5 句一段
- 段首第一句要抓人
- 段落之间用空行分隔，节奏明快

## 技巧
- 适当使用设问句与读者互动
- 可用"你"拉近距离
- 用具体故事或例子代替抽象说教
- 结尾有总结或行动号召

## 格式
- 仅输出正文内容
- 直接输出，不要额外说明`,
          temperature: 0.8,
          maxTokens: 4096,
        },
      },
      contextSources: [],
      dimensions: [
        { name: "正式度", value: 3 },
        { name: "修辞密度", value: 4 },
        { name: "叙事性", value: 6 },
      ],
    }),

    /* ── 4. 创意文学 ── */
    builtin("creative", {
      name: "创意文学",
      description: "富有文学性和感染力的写作风格，适合散文、随笔、叙事内容",
      icon: "✍️",
      scope: "full",
      configs: {
        title: {
          systemPrompt:
`为文学作品生成一个富有诗意的标题。

## 规则
- 可以含蓄、意象化、有想象空间
- 不必直白概括内容
- 控制在 5-18 字
- 直接输出标题`,
          temperature: 0.9,
        },
        description: {
          systemPrompt:
`写一句有文学感的引子，引导读者进入氛围。

## 规则
- 不一定要概括内容，重在营造氛围
- 可以有画面感、情绪
- 15-50 字
- 直接输出`,
          temperature: 0.9,
        },
        outline: {
          systemPrompt:
`为文学作品规划篇章脉络。

## 输出格式
编号列表，每行一个篇章。

## 规则
- 不追求逻辑结构，关注情绪和节奏的推进
- 每个篇章有一个情绪锚点
- 控制在 3-6 个篇章
- 描述可以感性、意象化`,
          temperature: 0.85,
        },
        writing: {
          systemPrompt:
`以文学创作的方式撰写内容。

## 语言
- 使用文学性语言，避免平铺直叙
- 善用修辞手法：比喻、拟人、排比、对仗、通感
- 控制节奏和韵律，长短句交替
- 注重画面感，调动五感（视觉、听觉、触觉、嗅觉、味觉）

## 技巧
- 细节描写服务于氛围和主题，不堆砌
- 避免陈词滥调和空洞套话
- 用具体意象传达抽象情绪
- 张弛有度，高潮处发力，平缓处蓄势

## 格式
- 仅输出正文内容
- 段落之间用空行分隔
- 直接输出，不要额外说明`,
          temperature: 0.9,
          maxTokens: 4096,
        },
      },
      contextSources: [],
      dimensions: [
        { name: "正式度", value: 4 },
        { name: "修辞密度", value: 9 },
        { name: "叙事性", value: 8 },
      ],
    }),

    /* ── 5. 自媒体爆款 ── */
    builtin("viral", {
      name: "自媒体爆款",
      description: "强传播力的自媒体风格，适合公众号、头条、小红书等平台",
      icon: "📱",
      scope: "full",
      configs: {
        title: {
          systemPrompt:
`生成一个强传播力的自媒体标题。

## 规则
- 可使用数字（"3 个方法""5 个坑"）
- 可使用悬念、冲突、反差、痛点
- 可以使用情绪化词汇
- 控制在 12-25 字
- 准确反映内容，不标题党
- 直接输出标题`,
          temperature: 0.9,
          maxTokens: 512,
        },
        description: {
          systemPrompt:
`写一句引人好奇的导读。

## 规则
- 点出读者痛点或渴望
- 制造悬念或价值预期
- 口语化，有情绪
- 15-50 字
- 直接输出`,
          temperature: 0.85,
        },
        writing: {
          systemPrompt:
`以自媒体爆款风格写作。

## 开头
- 前 100 字必须抓住注意力
- 可用痛点提问、惊人数据、反常识观点开场

## 段落
- 段落短小，2-4 句一段
- 多用换行制造视觉节奏
- 重要观点单独成段

## 内容
- 有金句意识，每段至少一句可截图传播
- 多用设问、反问制造互动感
- 适当使用加粗强调核心观点
- 用具体案例、故事代替抽象论述

## 结尾
- 总结核心观点
- 引导互动（点赞/评论/转发/收藏）

## 格式
- 仅输出正文内容
- 直接输出，不要额外说明`,
          temperature: 0.85,
          maxTokens: 4096,
        },
      },
      contextSources: [],
      dimensions: [
        { name: "正式度", value: 2 },
        { name: "修辞密度", value: 6 },
        { name: "叙事性", value: 7 },
      ],
    }),

    /* ── 6. 技术教程 ── */
    builtin("tutorial", {
      name: "技术教程",
      description: "清晰的技术教程风格，适合开发教程、操作指南、最佳实践",
      icon: "💻",
      scope: "full",
      configs: {
        title: {
          systemPrompt:
`为技术教程生成清晰的标题。

## 规则
- 包含核心技术和关键动作（如"用 React 构建…""从零实现…"）
- 明确读者能学到什么
- 控制在 10-25 字
- 直接输出标题`,
          temperature: 0.5,
        },
        description: {
          systemPrompt:
`写一段教程简介，说清楚读者将从中学到什么。

## 规则
- 说明教程的目标和前置知识
- 列出核心知识点
- 30-80 字
- 直接输出`,
          temperature: 0.5,
        },
        outline: {
          systemPrompt:
`为技术教程生成步骤清晰的大纲。

## 输出格式
编号列表，每行一个章节。

## 规则
- 章节递进：环境准备 → 核心概念 → 逐步实现 → 进阶 → 总结
- 步骤之间逻辑连贯，环环相扣
- 控制在 4-8 个章节`,
          temperature: 0.5,
        },
        tags: {
          systemPrompt:
`为技术教程生成标签。

## 规则
- 包含编程语言、框架、技术领域
- 覆盖核心知识点
- 3-6 个标签，用空格分隔
- 直接输出`,
          temperature: 0.4,
        },
        writing: {
          systemPrompt:
`以技术教程风格撰写章节内容。

## 结构
- 步骤清晰，循序渐进
- 先说明"要做什么"，再解释"为什么这样做"
- 指出常见坑点和注意事项

## 代码
- 代码示例可运行、有注释
- 关键行加注释说明
- 代码块标明语言

## 语言
- 准确但不晦涩
- 用"我们"拉近距离
- 避免废话，信息密度高

## 格式
- 仅输出正文内容
- 段落之间用空行分隔
- 直接输出，不要额外说明`,
          temperature: 0.6,
          maxTokens: 4096,
        },
      },
      contextSources: [
        { type: "project", label: "关联项目目录", required: false },
      ],
      dimensions: [
        { name: "正式度", value: 6 },
        { name: "修辞密度", value: 3 },
        { name: "叙事性", value: 3 },
      ],
    }),

    /* ── 7. 商业文案 ── */
    builtin("business", {
      name: "商业文案",
      description: "有说服力的商业文案风格，适合产品介绍、营销内容、品牌故事",
      icon: "📦",
      scope: "full",
      configs: {
        title: {
          systemPrompt:
`为商业内容生成有说服力的标题。

## 规则
- 突出价值主张和差异化优势
- 可针对目标客户痛点
- 控制在 10-22 字
- 直接输出标题`,
          temperature: 0.8,
        },
        description: {
          systemPrompt:
`写一句有说服力的导语。

## 规则
- 点出客户痛点和解决方案
- 暗示独特价值
- 20-60 字
- 直接输出`,
          temperature: 0.75,
        },
        writing: {
          systemPrompt:
`以商业文案风格撰写内容。

## 结构
- 以用户痛点和需求为切入点
- 突出价值主张和差异化优势
- 结构清晰：吸引注意 → 建立信任 → 说服 → 转化

## 语言
- 使用有说服力的语言
- 用数据、案例、社会证明支撑观点
- 避免空洞的营销套话
- 可直接对读者说话（"你"）

## 结尾
- 有明确的行动号召（CTA）
- 降低行动门槛

## 格式
- 仅输出正文内容
- 段落之间用空行分隔
- 直接输出，不要额外说明`,
          temperature: 0.75,
          maxTokens: 4096,
        },
      },
      contextSources: [],
      dimensions: [
        { name: "正式度", value: 6 },
        { name: "修辞密度", value: 7 },
        { name: "叙事性", value: 5 },
      ],
    }),

    /* ── 8. 新闻报道 ── */
    builtin("news", {
      name: "新闻报道",
      description: "客观中立的新闻报道风格，适合资讯、事件报道、行业动态",
      icon: "📰",
      scope: "full",
      configs: {
        title: {
          systemPrompt:
`为新闻报道生成客观准确的标题。

## 规则
- 概括核心事实
- 使用主语+谓语+宾语的直述结构
- 避免修辞和情绪化词汇
- 控制在 10-22 字
- 直接输出标题`,
          temperature: 0.4,
        },
        description: {
          systemPrompt:
`写一段新闻导语。

## 规则
- 涵盖 5W1H 核心要素
- 最重要的信息在最前面
- 客观陈述，不加评论
- 30-80 字
- 直接输出`,
          temperature: 0.4,
        },
        outline: {
          systemPrompt:
`为新闻报道生成结构大纲。

## 输出格式
编号列表。

## 规则
- 倒金字塔结构：核心事实 → 背景 → 细节 → 影响 → 展望
- 信息重要性递减
- 控制在 3-6 个章节`,
          temperature: 0.4,
        },
        writing: {
          systemPrompt:
`以新闻报道风格撰写内容。

## 结构
- 倒金字塔结构：最重要的信息在最前面
- 每段都是一个独立的信息单元
- 段落短小，信息密度高

## 语言
- 客观中立，不加主观评价
- 使用规范的新闻用语
- 引用需标明来源
- 避免形容词堆砌

## 要素
- 5W1H 要素齐全
- 时间、地点、人物、事件、原因、方式清晰

## 格式
- 仅输出正文内容
- 段落之间用空行分隔
- 直接输出，不要额外说明`,
          temperature: 0.5,
          maxTokens: 4096,
        },
      },
      contextSources: [],
      dimensions: [
        { name: "正式度", value: 8 },
        { name: "修辞密度", value: 3 },
        { name: "叙事性", value: 5 },
      ],
    }),
  ];
}

/* ─── 阶段技能示例 ─── */



/* ─── 工具函数 ─── */

/** 获取所有内置技能（全量 + 阶段） */
export function getAllBuiltinSkills(): WritingSkill[] {
  return getBuiltinSkills();
}

/** 按 ID 查找技能 */
export function findSkill(id: string, customs?: WritingSkill[]): WritingSkill | undefined {
  const all = [...(customs || []), ...getAllBuiltinSkills()];
  return all.find((s) => s.id === id);
}

/** 获取默认技能 */
export function getDefaultSkill(): WritingSkill {
  return getBuiltinSkills()[0];
}

/** 获取某个阶段生效的配置（技能配置优先，fallback 到默认） */
export function getEffectivePhaseConfig(
  skill: WritingSkill | undefined,
  phase: SkillPhase,
): PhaseConfig {
  const phaseConfig = skill?.configs?.[phase];
  const defaults = DEFAULT_PHASE_CONFIGS[phase];
  if (!phaseConfig) return defaults;

  return {
    systemPrompt: phaseConfig.systemPrompt ?? defaults.systemPrompt,
    temperature: phaseConfig.temperature ?? defaults.temperature,
    model: phaseConfig.model ?? defaults.model,
    maxTokens: phaseConfig.maxTokens ?? defaults.maxTokens,
  };
}

/** 获取技能支持的阶段列表 */
export function getSkillPhases(skill: WritingSkill): SkillPhase[] {
  if (skill.scope === "phase" && skill.phase) {
    return [skill.phase];
  }
  return ["title", "description", "outline", "tags", "writing"];
}

/** 生成新技能的 ID */
export function generateSkillId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 创建空的技能模板（用于自定义编辑） */
export function createEmptySkill(): WritingSkill {
  return {
    id: generateSkillId(),
    name: "",
    description: "",
    icon: "📝",
    scope: "full",
    configs: {},
    contextSources: [],
    tools: [],
    dimensions: [
      { name: "正式度", value: 5 },
      { name: "修辞密度", value: 5 },
      { name: "叙事性", value: 5 },
    ],
    builtin: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/* ─── 存储 ─── */

const CUSTOM_SKILLS_KEY = "aiwriter-custom-skills";

/** 加载自定义技能（Tauri 模式从后端加载，浏览器模式从 localStorage 加载） */
export async function loadCustomSkills(): Promise<WritingSkill[]> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<WritingSkill[]>("list_writing_skills");
    } catch { /* fallback */ }
  }
  try {
    const raw = localStorage.getItem(CUSTOM_SKILLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** 保存自定义技能 */
export async function saveCustomSkill(skill: WritingSkill): Promise<void> {
  skill.updatedAt = Date.now();
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("save_writing_skill", { skill });
      return;
    } catch { /* fallback */ }
  }
  // Browser fallback
  const skills = await loadCustomSkills();
  const idx = skills.findIndex((s) => s.id === skill.id);
  if (idx >= 0) skills[idx] = skill;
  else skills.push(skill);
  localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(skills));
}

/** 删除自定义技能 */
export async function deleteCustomSkill(id: string): Promise<void> {
  if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("delete_writing_skill", { id });
      return;
    } catch { /* fallback */ }
  }
  const skills = await loadCustomSkills();
  const filtered = skills.filter((s) => s.id !== id);
  localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(filtered));
}

/** 合并内置 + 自定义技能列表 */
export async function getAllSkills(): Promise<WritingSkill[]> {
  const customs = await loadCustomSkills();
  const builtins = getAllBuiltinSkills();
  // 自定义技能覆盖同 id 的内置技能（允许用户编辑内置副本）
  const merged = new Map<string, WritingSkill>();
  for (const s of builtins) merged.set(s.id, s);
  for (const s of customs) merged.set(s.id, s);
  return Array.from(merged.values());
}

/** 查找技能（含自定义），异步版本 */
export async function findSkillAsync(id: string): Promise<WritingSkill | undefined> {
  const customs = await loadCustomSkills();
  return findSkill(id, customs);
}
