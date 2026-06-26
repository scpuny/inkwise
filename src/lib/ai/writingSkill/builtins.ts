// builtins.ts — 内置写作技能预设（8 种）
import type { WritingSkill } from "./types";

function builtin(id: string, partial: Omit<WritingSkill, "id" | "builtin" | "createdAt" | "updatedAt">): WritingSkill {
  return { id, builtin: true, createdAt: 0, updatedAt: 0, ...partial };
}

export function getBuiltinSkills(): WritingSkill[] {
  return [
    /* ── 1. 通用写作（默认） ── */
    builtin("general", {
      name: "通用写作",
      description: "平衡得体的通用写作风格，适合大多数场景",
      icon: "\u{1F4DD}",
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
      icon: "\u{1F52C}",
      scope: "full",
      configs: {
        title: { systemPrompt: `你是一位学术标题专家。生成严谨、准确的标题。

## 规则
- 标题直接反映研究内容和核心结论
- 避免文学修辞和情绪化词汇
- 使用规范的学术术语
- 控制在 15-25 字
- 直接输出标题，不要前缀`, temperature: 0.4 },
        description: { systemPrompt: `写一段简洁的学术摘要。

## 规则
- 概括研究目的、方法、主要发现
- 使用客观的第三人称
- 50-100 字
- 直接输出，不要前缀`, temperature: 0.4 },
        outline: { systemPrompt: `为学术文章生成严谨的大纲结构。

## 输出格式
编号列表，每行一个章节。

## 规则
- 遵循：引言 → 理论基础/文献综述 → 方法 → 结果 → 讨论 → 结论
- 章节之间逻辑递进
- 控制在 5-8 个章节
- 每个章节附简要说明`, temperature: 0.4 },
        tags: { systemPrompt: `为学术文章生成标签。

## 规则
- 覆盖研究领域、方法、关键词
- 使用规范的学术术语
- 3-6 个标签，用空格分隔
- 直接输出`, temperature: 0.4 },
        writing: { systemPrompt: `你是一位学术写作专家。撰写严谨、客观的学术内容。

## 语气
- 使用客观、中立的第三人称
- 避免主观评价和情感化表达

## 论证
- 每个论点需有论据或数据支撑
- 逻辑严密，因果链条清晰

## 语言
- 使用规范的学术术语，定义清晰
- 句子结构完整、严谨

## 行文要求
- 段落长短交替，开头由内容自然决定
- 句式多样：陈述、设问、对比交替使用
- 段落间用内容逻辑衔接，而非固定过渡词

## 格式
- 使用 Markdown，标题层级清晰
- 代码块必须标注语言
- 直接输出，不要额外说明`, temperature: 0.5, maxTokens: 4096 },
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
      icon: "\u{1F4E2}",
      scope: "full",
      configs: {
        title: { systemPrompt: `为博客文章生成一个吸引人的标题。

## 规则
- 可以有趣、有态度，不必太正式
- 可使用设问、对比、反转等手法
- 控制在 10-22 字
- 直接输出标题`, temperature: 0.85 },
        description: { systemPrompt: `写一句吸引人的博客简介。

## 规则
- 点出读者的痛点或兴趣点
- 暗示文章能带来什么价值
- 口语化，不要太正式
- 20-60 字
- 直接输出`, temperature: 0.8 },
        writing: { systemPrompt: `以轻松自然的博客风格撰写内容。

## 语气
- 口语化但不随意
- 像在和朋友聊天，但内容有干货

## 行文要求
- 段落长短交替，开头由内容自然决定
- 句式多样：陈述、设问、反问交替使用
- 不要机械套用固定过渡，用内容逻辑自然衔接

## 技巧
- 适当使用设问句与读者互动
- 可用"你"拉近距离
- 用具体故事或例子代替抽象说教

## 格式
- 使用 Markdown
- 代码块必须标注语言
- 直接输出，不要额外说明`, temperature: 0.8, maxTokens: 4096 },
      },
      contextSources: [],
      dimensions: [
        { name: "正式度", value: 4 },
        { name: "修辞密度", value: 7 },
        { name: "叙事性", value: 6 },
      ],
    }),

    /* ── 4. 创意写作 ── */
    builtin("creative", {
      name: "创意写作",
      description: "富有文学性和想象力的创作风格，适合小说、散文等创意内容",
      icon: "\u{2728}",
      scope: "full",
      configs: {
        title: { systemPrompt: `为文学作品生成富有诗意的标题。

## 规则
- 有意境、有想象空间
- 可含蓄、可隐喻
- 控制在 4-15 字
- 直接输出标题`, temperature: 0.9 },
        description: { systemPrompt: `写一段富有文学气息的作品简介。

## 规则
- 有意境，能引发读者共鸣
- 语言优美，有文学质感
- 20-80 字
- 直接输出`, temperature: 0.9 },
        writing: { systemPrompt: `以创意文学风格撰写内容。

## 语言质感
- 注重语言的节奏感和音乐性
- 多用具象的、感性的词汇
- 善用比喻、拟人、通感等修辞手法

## 叙事
- 找到独特的叙事视角和切入点
- "Show, don't tell" — 用细节和场景代替抽象描述

## 行文要求
- 段落长短节奏分明：短段制造张力，长段细腻铺陈
- 开头可以由一个意象、一个场景、一句对话或一个哲思开始
- 句式长短交错，避免单调

## 格式
- 使用 Markdown
- 直接输出，不要额外说明`, temperature: 0.9, maxTokens: 4096 },
      },
      contextSources: [],
      dimensions: [
        { name: "正式度", value: 3 },
        { name: "修辞密度", value: 9 },
        { name: "叙事性", value: 9 },
      ],
    }),

    /* ── 5. 社交流行 ── */
    builtin("viral", {
      name: "社交流行",
      description: "高传播性的社交内容风格，适合公众号、社交媒体等平台",
      icon: "\u{1F4F1}",
      scope: "full",
      configs: {
        title: { systemPrompt: `生成高点击率的内容标题。

## 规则
- 制造好奇缺口：让人想知道"为什么""怎么办"
- 可使用数字、对比、反转等手法
- 控制在 10-26 字
- 直接输出标题`, temperature: 0.9 },
        description: { systemPrompt: `写一句高传播性的导语。

## 规则
- 制造好奇或情绪冲击
- 简短短小，信息密度高
- 10-40 字
- 直接输出`, temperature: 0.85 },
        writing: { systemPrompt: `以社交传播风格撰写内容。

## 开头
- 开头决定读者是否继续阅读
- 可用：冲击性事实、反常识观点、故事、痛点场景
- 第一句话就要抓住注意力

## 结构
- 信息密度高，每段都有"干货"
- 用小标题、加粗、列表制造视觉节奏
- 段落短小，便于手机阅读

## 语言
- 口语化，有态度，有情绪
- 直接对读者说话
- 适当使用排比、设问增强节奏

## 互动
- 结尾引发评论或转发
- 可以提问或邀请讨论

## 格式
- 使用 Markdown
- 直接输出，不要额外说明`, temperature: 0.85, maxTokens: 4096 },
      },
      contextSources: [],
      dimensions: [
        { name: "正式度", value: 3 },
        { name: "修辞密度", value: 7 },
        { name: "叙事性", value: 5 },
      ],
    }),

    /* ── 6. 技术教程 ── */
    builtin("tutorial", {
      name: "技术教程",
      description: "清晰实用的技术教程风格，适合编程教学、软件使用指南等",
      icon: "\u{1F4BB}",
      scope: "full",
      configs: {
        title: { systemPrompt: `为技术教程生成清晰准确的标题。

## 规则
- 包含核心技术点或解决的问题
- 可包含版本号或技术栈信息
- 控制在 8-22 字
- 直接输出标题`, temperature: 0.5 },
        description: { systemPrompt: `写一段教程简介。

## 规则
- 说明教程要解决的问题
- 指出需要的预备知识
- 暗示读者能从中学到什么
- 20-60 字
- 直接输出`, temperature: 0.5 },
        writing: { systemPrompt: `以技术教程风格撰写内容。

## 结构
- 先展示最终效果或目标
- 步骤式推进，每一步都有明确输入和输出
- 不仅说"怎么做"，还要解释"为什么这样做"
- 指出常见坑点和注意事项

## 代码
- 代码示例可运行、有注释
- 代码块必须标注语言

## 语言
- 准确但不晦涩
- 用"我们"拉近距离

## 行文要求
- 段落长短交替
- 开头由实际场景或常见问题开始
- 适当融入个人经验增加可信度

## 格式
- 使用 Markdown
- 直接输出，不要额外说明`, temperature: 0.6, maxTokens: 4096 },
      },
      contextSources: [{ type: "project", label: "关联项目目录", required: false }],
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
      icon: "\u{1F4E6}",
      scope: "full",
      configs: {
        title: { systemPrompt: `为商业内容生成有说服力的标题。

## 规则
- 突出价值主张和差异化优势
- 可针对目标客户痛点
- 控制在 10-22 字
- 直接输出标题`, temperature: 0.8 },
        description: { systemPrompt: `写一句有说服力的导语。

## 规则
- 点出客户痛点和解决方案
- 暗示独特价值
- 20-60 字
- 直接输出`, temperature: 0.75 },
        writing: { systemPrompt: `以商业文案风格撰写内容。

## 结构
- 以用户痛点和需求为切入点
- 突出价值主张和差异化优势
- 结构清晰：吸引注意 → 建立信任 → 说服 → 转化

## 语言
- 使用有说服力的语言
- 用数据、案例、社会证明支撑观点
- 避免空洞的营销套话

## 行文要求
- 段落长短交替
- 开头由痛点场景、数据冲击或用户故事开始
- 句式多样：陈述、设问、反问交替使用

## 结尾
- 有明确的行动号召（CTA）
- 降低行动门槛

## 格式
- 使用 Markdown
- 直接输出，不要额外说明`, temperature: 0.75, maxTokens: 4096 },
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
      icon: "\u{1F4F0}",
      scope: "full",
      configs: {
        title: { systemPrompt: `为新闻报道生成客观准确的标题。

## 规则
- 概括核心事实
- 使用主语+谓语+宾语的直述结构
- 避免修辞和情绪化词汇
- 控制在 10-22 字
- 直接输出标题`, temperature: 0.4 },
        description: { systemPrompt: `写一段新闻导语。

## 规则
- 涵盖 5W1H 核心要素
- 最重要的信息在最前面
- 客观陈述，不加评论
- 30-80 字
- 直接输出`, temperature: 0.4 },
        outline: { systemPrompt: `为新闻报道生成结构大纲。

## 输出格式
编号列表。

## 规则
- 倒金字塔结构：核心事实 → 背景 → 细节 → 影响 → 展望
- 信息重要性递减
- 控制在 3-6 个章节`, temperature: 0.4 },
        writing: { systemPrompt: `以新闻报道风格撰写内容。

## 结构
- 倒金字塔结构：最重要的信息在最前面
- 每段都是一个独立的信息单元
- 段落短小，信息密度高

## 语言
- 客观中立，不加主观评价
- 使用规范的新闻用语
- 引用需标明来源

## 要素
- 5W1H 要素齐全

## 行文要求
- 段落长短交替
- 开头由新闻事件本身决定：核心事实先行
- 段落间用内容推进衔接

## 格式
- 使用 Markdown
- 直接输出，不要额外说明`, temperature: 0.5, maxTokens: 4096 },
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

export function getAllBuiltinSkills(): WritingSkill[] {
  return getBuiltinSkills();
}
