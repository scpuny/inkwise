# WritingSkill（写作技能）— 设计文档

> 版本: v1.1.0
> 状态: 已实现（v1.7.0+）
> 关联: plan.ts, skill.ts, builtins.ts, defaults.ts

---

## 1. 概述

### 1.1 问题现状

当前文章生成管线存在三个割裂的系统：

| 系统 | 职责 | 问题 |
|------|------|------|
| `tone` 5个硬编码 | 风格选择 | 只是一个字符串标签，AI 对"文艺"的理解全靠猜 |
| `skill.ts` | 快捷 AI 操作（润色/翻译/校对） | 本质是 prompt 片段，被过度架构化为"技能" |
| `plan.ts` | 文章分步生成 | prompt 固定写死，无法被外部配置 |

结果是：**文章风格单一、不可扩展、用户无法自定义**。

### 1.2 设计目标

- **统一**：用一个模型覆盖"从灵感录入到文章完成"的完整管线控制
- **可扩展**：用户可创建自定义技能，也可修改内置技能
- **有上下文感知**：技能能主动拉取关联目录、系列文章等上下文
- **渐进式**：先用简单的 prompt + 参数方案，后续逐步加入工具调用能力

---

## 2. 核心概念

### 2.1 什么是 WritingSkill

> **WritingSkill** = 怎么写（prompt）+ 用什么写（context）+ 写成什么样（参数）

一个 WritingSkill 是贯穿文章生成全管线（或某个阶段）的配置单元。用户选择一个技能后，AI 的每一步行为都受该技能控制。

### 2.2 与传统 Skill 的区分

| | 旧 skill.ts | WritingSkill |
|--|------------|--------------|
| 本质 | 一段 prompt 文本 | 结构化配置 + 多阶段控制 |
| 作用场景 | 对已有文本做一次性操作 | 从灵感到成文的完整管线 |
| 上下文感知 | 无 | 可声明需要项目上下文、系列上下文等 |
| 用户自定义 | 可装可删但粗糙 | 设计为可编辑、可克隆、可分享 |

**现有 skill.ts 中的 polish/rewrite/expand/translate/proofread** 降级为轻量级 **QuickPrompts**，不归入 WritingSkill 体系（但仍可保留功能）。

---

## 3. 数据结构

### 3.1 WritingSkill（核心模型）

```typescript
// 技能作用范围
type SkillScope = "full" | "phase";

// 技能适用的阶段（phase 时指定）
type SkillPhase = "title" | "description" | "outline" | "tags" | "writing";

// 上下文来源声明
interface ContextSource {
  type: "project" | "series" | "linked_folder" | "custom_text";
  label: string;           // 用户可见的描述
  required: boolean;       // 是否必须
  maxLength?: number;      // 截断长度
}

// 单个阶段的 AI 配置
interface PhaseConfig {
  systemPrompt: string;     // 核心：指导 AI 如何写作
  temperature?: number;     // 默认 0.7
  model?: string;           // 可选覆盖
  maxTokens?: number;       // 默认 1024
}

// 工具调用声明（未来扩展）
interface ToolDeclaration {
  name: string;             // read_file, search_document 等
  description: string;      // 何时使用
}

// 风格维度标签（用于分类筛选）
interface StyleDimension {
  name: string;             // 正式度、修辞密度、叙事性
  value: number;            // 0-10
}

interface WritingSkill {
  id: string;
  name: string;
  description: string;
  icon?: string;            // emoji 或图标名
  
  // 作用范围
  scope: SkillScope;
  phase?: SkillPhase;       // scope 为 phase 时生效
  
  // 各阶段配置（scope 为 full 时全部生效，phase 时仅对应阶段生效）
  configs: Partial<Record<SkillPhase, PhaseConfig>>;
  
  // 上下文来源声明
  contextSources: ContextSource[];
  
  // 工具调用（未来）
  tools?: ToolDeclaration[];
  
  // 风格维度标签
  dimensions: StyleDimension[];
  
  // 示例文本（few-shot）
  exampleText?: string;
  
  // 元信息
  builtin: boolean;         // 是否为内置
  createdAt: number;
  updatedAt: number;
}
```

### 3.2 设计要点

**为什么每个阶段可以独立配置 systemPrompt？**

因为不同阶段对 AI 的要求完全不同：
- **标题生成**：需要抓眼球、简洁
- **简介生成**：需要概括力
- **大纲生成**：需要结构感
- **正文写作**：需要展开论述和细节

同一技能在不同阶段可能需要不同的语气重点。比如"自媒体爆款"技能：
- 标题 → 悬念式、数字式
- 正文 → 口语化、短句、段首抓人

**为什么 temperature 可以分阶段？**

标题生成的 temperature 应该比正文低（更确定性），正文可以稍高（更创造性）。同一个技能在不同阶段可以有不同参数。

---

## 4. 内置预设

设计 8 个内置技能，覆盖常用写作场景。

### 4.1 通用写作（默认）

```
name: "通用写作"
scope: full
contextSources: []
dimensions: [{ 正式度: 5 }, { 修辞密度: 5 }]
configs:
  writing.systemPrompt: >
    【开篇要求】
    - 前 2 段内亮出核心卖点，不要用背景铺垫暖场
    - 第一段直接用具体场景、反差或问题切入
    - 避免"大家好""欢迎回到"等冗余开场白
    
    【结构与节奏】
    - 段落控制 3-5 行，适配手机阅读
    - 长短段交替：短段 1-2 句用于强调或转折
    - 每个大章节开头加一两句导读句
    - 避免"首先/其次/最后"开头的机械过渡
    
    【行文要求】
    - 信息密度高：每个句子都推进内容
    - 句式多样：陈述、设问、反问交替使用
    - 段落间过渡自然，用内容逻辑衔接
```

### 4.2 学术严谨

```
name: "学术严谨"
scope: full
dimensions: [{ 正式度: 9 }, { 修辞密度: 3 }, { 叙事性: 2 }]
temperature: 0.5
configs:
  title.systemPrompt: >
    为学术文章生成严谨、准确的标题。
    标题应直接反映研究内容和结论，避免文学修辞。
    控制在 15-25 字，使用规范的学术术语。
    直接输出标题，不要前缀和引号，只输出一行。
  writing.systemPrompt: >
    【开篇要求】
    - 从研究背景或问题切入，快速建立学术语境
    - 第一段交代研究动机和核心问题
    
    【语言规范】
    - 使用客观、中立的语气，避免主观评价和情感化表达
    - 每个论点需有论据或引用支撑，论证逻辑严密
    - 使用规范的学术术语，定义清晰
    - 避免口语化表达、修辞问句、感叹号
    - 引用格式规范，数据来源明确
    
    【结构要求】
    - 段落结构：主题句 → 展开论述 → 小结/过渡
    - 每个大章节开头加一句导读
    - 超长句拆成短句，一个观点只陈述一次
```

### 4.3 博客口语（默认博客技能）

```
name: "博客口语"
scope: full
dimensions: [{ 正式度: 3 }, { 修辞密度: 4 }, { 叙事性: 6 }]
temperature: 0.85
configs:
  title.systemPrompt: >
    为博客文章生成一个让人忍不住点开的标题。
    标题必须有「钩子」：设问、反差、数字、具体收益、反常识观点，至少命中一个。
    前 6 字包含核心观点或价值。
    控制在 10-22 字，信息密度高。
    直接输出标题，不要前缀和引号，只输出一行。
  description.systemPrompt: >
    写一句让读者觉得「这就是我需要的」的博客简介。
    第一句话点出读者痛点或兴趣点。
    暗示文章能带来什么具体价值或新认知。
    口语化但不随意，像和朋友推荐一篇好文。
    20-60 字，直接输出，只输出一行。
  writing.systemPrompt: >
    【开篇要求】
    - 第一段用具体场景、个人经历或反差问题切入，抓住注意力
    - 前 2 段亮出文章核心价值
    - 避免"大家好""欢迎来到"等冗余开场白
    
    【语气】
    - 口语化但不随意，有内容密度
    - 像在和一个聪明的朋友深入聊天
    - 用"你"拉近距离，但不滥用感叹号
    
    【结构与节奏】
    - 段落 3-5 行，适配手机阅读
    - 长短段交替，短段用于强调或转折
    - 每个大章节开头加一两句导读
    - 避免"首先/其次/最后"开头的机械过渡
    
    【技巧】
    - 适当使用设问句与读者互动
    - 用具体故事或例子代替抽象说教
    - 一个观点只讲一次，不反复换说法
    - 超长句拆成短句
```

### 4.4 创意文学

```
name: "创意文学"
scope: full
dimensions: [{ 正式度: 4 }, { 修辞密度: 9 }, { 叙事性: 8 }]
temperature: 0.9
configs:
  title.systemPrompt: >
    为文学作品生成富有诗意和想象空间的标题。
    有意境、有画面感、能引发读者想象。
    可含蓄、可隐喻、可设谜。
    控制在 4-15 字，直接输出，只输出一行。
  description.systemPrompt: >
    写一段富有文学气息的作品简介，让读者产生阅读冲动。
    有意境和情绪氛围，能引发读者共鸣。
    语言优美，有文学质感。
    暗示核心冲突或情感张力，但不剧透。
    20-80 字，直接输出，只输出一行。
  writing.systemPrompt: >
    【开篇要求】
    - 从一个具体意象、场景、对话或哲思瞬间切入
    - 第一段就让读者进入作品的氛围和情绪
    - 避免背景介绍式的平铺直叙
    
    【语言质感】
    - 注重语言的节奏感和音乐性
    - 多用具象的、感性的词汇，少用抽象概念
    - 善用比喻、拟人、通感等修辞手法
    - 每个词都有分量，不堆砌华丽辞藻
    
    【叙事】
    - 找到独特的叙事视角和切入点
    - "Show, don't tell" — 用细节和场景代替抽象描述
    - 控制信息释放的节奏，保持悬念
    
    【行文要求】
    - 段落长短节奏分明：短段制造张力，长段细腻铺陈
    - 句式长短交错，避免单调
    - 对话和叙述交替推进，调节阅读节奏
```

### 4.5 自媒体爆款（社交传播）

```
name: "自媒体爆款"
scope: full
dimensions: [{ 正式度: 2 }, { 修辞密度: 6 }, { 叙事性: 7 }]
temperature: 0.9
configs:
  title.systemPrompt: >
    生成让人忍不住点击的高传播标题。
    制造好奇缺口：让人想知道"为什么""怎么办""真的假的"。
    可使用数字、对比、反转、反常识等手法。
    前 6 字制造情绪冲击或信息反差。
    控制在 10-26 字，直接输出，只输出一行。
  description.systemPrompt: >
    写一句让人想转发的高传播导语。
    制造好奇或情绪冲击。
    简短短小，信息密度极高。
    暗示"读完有巨大收获"。
    10-40 字，直接输出，只输出一行。
  writing.systemPrompt: >
    以社交传播风格撰写内容，目标是高阅读量和高转发。
    
    【开头】
    - 可用：冲击性事实、反常识观点、个人故事、痛点场景
    - 第一句话就要抓住注意力，不要铺垫
    
    【结构与节奏】
    - 信息密度高，每段都有"干货"或情绪价值
    - 用小标题、加粗、列表制造视觉节奏
    - 段落短小（2-4 行），每段一个独立信息点
    - 长短段交替制造阅读节奏
    
    【语言】
    - 有态度、有情绪、有记忆点
    - 直接对读者说话，用"你"拉近距离
    - 适当使用排比、设问增强节奏
    - 调性统一，不混搭风格
    
    【传播设计】
    - 结尾引发评论或转发
    - 可以提问、邀请讨论或制造共鸣
    - 金句单独成段，方便截图传播
```
    - 适当使用加粗强调关键观点
    - 结尾引导互动（点赞/评论/转发）
```

### 4.6 技术教程

```
name: "技术教程"
scope: full
contextSources: [{ type: "project", label: "关联项目目录", required: false }]
dimensions: [{ 正式度: 6 }, { 修辞密度: 3 }, { 叙事性: 3 }]
temperature: 0.5
configs:
  title.systemPrompt: >
    为技术教程生成清晰、有吸引力的标题。
    包含核心技术点或解决的问题。
    可包含版本号或技术栈信息增加精准度。
    暗示学习收益：读完能做什么。
    控制在 8-22 字，直接输出，只输出一行。
  description.systemPrompt: >
    写一段让开发者觉得「这个我需要学」的教程简介。
    说明教程要解决的具体问题。
    指出需要的预备知识。
    暗示读者能从中学到什么（具体技能或方案）。
    使用"你将学会"等收益导向表达。
    20-60 字，直接输出，只输出一行。
  writing.systemPrompt: >
    【开篇要求】
    - 第一段展示最终效果或目标，让读者知道"学完能做什么"
    - 从实际场景或常见问题切入，建立共鸣
    - 前 2 段交代教程的受众和前置知识要求
    
    【结构与节奏】
    - 步骤式推进，每一步都有明确输入和输出
    - 不仅说"怎么做"，还要解释"为什么这样做"
    - 指出常见坑点和注意事项，节省读者排查时间
    - 每个大章节开头加导读句
    
    【代码准则】
    - 代码示例必须可运行、有充分注释
    - 代码上方用一句话说明这段代码的作用
    - 代码块必须标注语言
    - 核心逻辑用注释解释，不要假设读者能看懂
    
    【语言】
    - 准确但不晦涩
    - 用"我们"拉近距离，用"你"引导操作
    - 适当融入个人经验增加可信度
    - 避免重复啰嗦
```

### 4.7 商业文案

```
name: "商业文案"
scope: full
dimensions: [{ 正式度: 6 }, { 修辞密度: 7 }, { 叙事性: 5 }]
temperature: 0.8
configs:
  title.systemPrompt: >
    为商业内容生成有说服力、能转化的标题。
    突出价值主张和差异化优势。
    可针对目标客户痛点或渴望。
    使用具体数字、结果导向的表达。
    控制在 10-22 字，直接输出，只输出一行。
  description.systemPrompt: >
    写一段有说服力的导语，让客户愿意继续读下去。
    第一句话直击客户痛点或渴望。
    暗示解决方案带来的核心价值。
    有具体的收益承诺。
    20-60 字，直接输出，只输出一行。
  writing.systemPrompt: >
    以商业文案风格撰写有说服力的内容。
    
    【结构】
    - 以用户痛点或需求为切入点
    - 突出价值主张和差异化优势
    - 结构清晰：吸引注意 → 建立信任 → 说服 → 转化
    
    【语言】
    - 使用有说服力的语言，但不浮夸
    - 用数据、案例、社会证明支撑观点
    - 避免空洞的营销套话
    - 多用"你"拉近距离
    
    【行文要求】
    - 段落 3-5 行，适配手机阅读
    - 开头由痛点场景、数据冲击或用户故事开始
    - 句式多样：陈述、设问、反问交替使用
    - 段落间用内容逻辑自然衔接
    
    【结尾】
    - 有明确的行动号召（CTA）
    - 降低行动门槛
    - 制造紧迫感或稀缺感
```

### 4.8 新闻报道

```
name: "新闻报道"
scope: full
dimensions: [{ 正式度: 8 }, { 修辞密度: 3 }, { 叙事性: 5 }]
temperature: 0.4
configs:
  title.systemPrompt: >
    为新闻报道生成客观、准确的标题。
    概括核心事实，让读者一眼了解事件内容。
    使用主语+谓语+宾语的直述结构。
    避免修辞和情绪化词汇。
    控制在 10-22 字，直接输出，只输出一行。
  description.systemPrompt: >
    写一段新闻导语，涵盖核心信息。
    涵盖 5W1H 核心要素（谁、何时、何地、何事、为何、如何）。
    最重要的信息在最前面。
    客观陈述，不加主观评论。
    30-80 字，直接输出，只输出一行。
  outline.systemPrompt: >
    为新闻报道生成信息层级清晰的大纲。
    输出格式：编号列表。
    倒金字塔结构：核心事实 → 背景 → 细节 → 影响 → 展望。
    信息重要性递减。
    每个章节有明确的信息增量。
    控制在 3-6 个章节。
  writing.systemPrompt: >
    以新闻报道风格撰写内容。
    
    【结构】
    - 倒金字塔结构：最重要的信息在最前面
    - 每段都是一个独立的信息单元
    - 段落短小（2-4 行），信息密度高
    
    【语言】
    - 客观中立，不加主观评价
    - 使用规范的新闻用语
    - 引用需标明来源
    - 避免重复描述同一信息
    
    【行文要求】
    - 开头由核心事实先行，不铺垫
    - 每段递进补充信息细节
    - 段落间用内容推进衔接
```

### 4.9 营销文案（v1.4.0 新增）

```
name: "营销文案"
scope: full
dimensions: [{ 正式度: 3 }, { 修辞密度: 7 }, { 叙事性: 6 }]
temperature: 0.85
configs:
  title.systemPrompt: >
    为营销内容生成能提高点击率和转化的标题。
    突出核心卖点和用户利益。
    可运用数字、对比、设问、反差等手法。
    前 6 字包含核心价值或情绪触发。
    控制在 8-18 字，直接输出，只输出一行。
  description.systemPrompt: >
    写一段能激发欲望的营销导语。
    第一句话直击目标受众痛点和渴望。
    暗示独特价值主张。
    制造紧迫感或好奇心。
    20-50 字，直接输出，只输出一行。
  outline.systemPrompt: >
    为营销文案生成说服力递进的大纲。
    遵循：吸引注意 → 激发兴趣 → 建立信任 → 促成行动。
    每个部分有清晰的目标。
    控制在 4-6 个章节。
  tags.systemPrompt: >
    为营销文案生成精准的标签。
    覆盖目标受众、产品类型、营销角度。
    使用目标客户常用的搜索词。
    第一个标签为最核心的产品/服务。
    3-6 个标签，用空格分隔。
  writing.systemPrompt: >
    以营销文案风格撰写有转化力的内容。
    
    【结构】
    - 开头用标题或问题抓住注意力
    - 围绕卖点展开，逐个攻破
    - 用社会证明（案例/数据/用户评价）增强信任
    - 结尾强化CTA
    
    【语言】
    - 有说服力但不浮夸
    - 多用"你"拉近距离
    - 使用有力的动词和具体的数字
    - 调性统一，不混搭风格
    - 避免重复同一卖点
    
    【行文要求】
    - 段落 2-4 行，适配手机阅读
    - 开头由痛点场景、数据冲击或故事开始
    - 句式多样：陈述、设问、反问交替使用
```

### 4.10 产品文档（v1.4.0 新增）

```
name: "产品文档"
scope: full
dimensions: [{ 正式度: 7 }, { 修辞密度: 2 }, { 叙事性: 2 }]
temperature: 0.3
configs:
  title.systemPrompt: >
    为产品文档生成清晰、准确的标题。
    直接反映文档内容和用途。
    包含产品名称或功能点。
    让读者一眼知道"这是什么文档"。
    控制在 6-18 字，直接输出，只输出一行。
  outline.systemPrompt: >
    为产品文档生成逻辑清晰的大纲。
    遵循：概述 → 快速开始 → 核心概念 → 操作指南 → API/配置参考 → 常见问题。
    层级分明，逻辑递进。
    控制在 4-8 个章节，每个章节有明确的信息目标。
  writing.systemPrompt: >
    以产品文档风格撰写内容。
    
    【语气】
    - 客观冷静，信息密度高
    - 使用规范的技术用语
    
    【结构】
    - 每个章节聚焦一个功能或概念
    - 先说明"是什么"，再说明"怎么用"
    - 步骤式操作说明，每一步都有明确输入和输出
    - 每个大章节开头加一句导读
    
    【语言】
    - 规范的技术用语，定义清晰
    - 避免模糊词汇和主观评价
    - 使用一致的术语和命名
    
    【代码与技术内容】
    - 代码块上方用一句话说明作用
    - 核心参数用注释说明
    - 使用表格对比参数或配置项
    
    【行文要求】
    - 段落 3-5 行，信息密度高
    - 开头由产品功能或用户场景开始
    - 不重复说明同一功能点
```

### 4.11 书评影评（v1.4.0 新增）

```
name: "书评影评"
scope: full
dimensions: [{ 正式度: 6 }, { 修辞密度: 7 }, { 叙事性: 5 }]
temperature: 0.8
configs:
  title.systemPrompt: >
    为评论文章生成有态度、有观点的标题。
    体现核心观点或评价立场。
    可以有趣、有态度、有反转。
    让读者一看就知道"这篇文章站在什么立场"。
    控制在 8-20 字，直接输出，只输出一行。
  description.systemPrompt: >
    写一段引人入胜的评论简介，让读者想知道你的独特见解。
    点出作品的亮点或争议点。
    暗示你的独特视角或评价立场。
    避免空洞的"值得一看"。
    20-60 字，直接输出，只输出一行。
  writing.systemPrompt: >
    以评论风格撰写有深度、有态度的内容。
    
    【开篇要求】
    - 开头给出总体评价或核心观点，快速建立立场
    - 用一个具体细节或场景切入
    - 前 2 段交代作品的类型和基本背景
    
    【语气】
    - 有见地但不武断
    - 个人观点明确但有理有据
    - 尊重作品，但保持批判性思维
    
    【结构】
    - 从多个维度分析（剧情/表演/写作手法/思想内涵等）
    - 具体例证支撑观点，避免空洞评价
    - 避免剧透或提前标注剧透
    - 每个大章节开头加一句导读
    
    【语言】
    - 精准的鉴赏术语
    - 既有感性体悟也有理性分析
    - 避免空洞的赞美或贬低
    - 一个观点只陈述一次
    
    【行文要求】
    - 段落 3-5 行，适配手机阅读
    - 句式多样：陈述、设问、对比交替使用
```

### 4.12 阶段技能示例

```
name: "标题生成器"
scope: phase
phase: title
dimensions: [{ 正式度: 5 }, { 修辞密度: 7 }]
configs:
  title.systemPrompt: >
    你是一位标题创作专家。根据文章内容生成 5 个高质量标题选项。
    每个标题控制在 10-25 字。
    覆盖不同类型：直白型、悬念型、数字型、提问型。
    直接列出编号，不要额外说明。
  title.temperature: 0.9
  title.maxTokens: 512
```

---

## 5. 接入管线

### 5.1 现有流程改造

```
StartupSplash（用户选技能）
    │
    ├── 旧：5个硬编码 tone 下拉
    └── 新：技能选择器（列出所有 WritingSkill）
         ├── 内置技能
         ├── 用户自定义技能
         └── 默认：通用写作
    │
    ▼
PlanInput 增加 skillId 字段
    │
    ▼
plan.ts 各步骤读取技能配置
    │
    ├── generateTitle()
    │   ├── 使用 skill.configs.title.systemPrompt || 通用 prompt
    │   └── 使用 skill.configs.title.temperature || 通用温度
    │
    ├── generateDescription()
    │   └── 同上
    │
    ├── generateOutline()
    │   └── 同上
    │
    ├── generateTags()
    │   └── 同上
    │
    └── writeArticleSection()
        ├── 注入writing.systemPrompt 到 sysPrompt
        └── 按 skill.configs.writing.temperature 调用
```

### 5.2 上下文注入逻辑

当技能声明了 contextSources 时，选择技能后在生成前先收集上下文：

```
用户选择「技术教程」技能（声明需要 project_context）
    │
    ▼
检查当前文章是否关联了项目目录
    │
    ├── 是 → 调用 getProjectContext() / getCollectionFolderContext()
    │         结果注入到 plan.ts 的 buildProjectContextPrompt()
    │
    └── 否 → 如果 required 为 true，提示用户关联目录
             如果 required 为 false，跳过上下文集，仅提醒
    │
    ▼
后续各阶段 prompt 自动包含项目上下文
```

### 5.3 Prompt 组装逻辑（plan.ts 改造点）

当前：
```
systemPrompt = `你是一位标题创作专家…${baseRules}`
```

改造后：
```
const skillPrompt = skill.configs.title?.systemPrompt || DEFAULT_TITLE_PROMPT;
const projectCtx = skill.contextSources.some(cs => cs.type === 'project' && 有上下文)
  ? buildProjectContextPrompt(ctx)
  : '';
const systemPrompt = `${projectCtx}\n\n${skillPrompt}`;
```

---

## 6. 存储方案

### 6.1 双模式存储

**Tauri 桌面模式**：
```
~/.inkwise/style-templates/
├── builtin/                  ← 内置预设（只读）
│   ├── general.json
│   ├── academic.json
│   ├── blog.json
│   └── ...
└── custom/                   ← 用户自定义
    ├── my-style.json
    └── ...
```

**浏览器模式**：
- 内置预设：代码中硬编码（getBuiltinSkills 同类机制）
- 用户自定义：localStorage 键 `inkwise-custom-skills`

### 6.2 SkillStore 扩展（Rust 侧）

现有的 `SkillStore` 不做大改，新增一个 `StyleTemplateStore`：

```rust
pub struct StyleTemplateStore {
    builtins: Vec<WritingSkill>,
    customs: Vec<WritingSkill>,
}

impl StyleTemplateStore {
    pub fn list(&self) -> Vec<WritingSkill>;      // 列出所有
    pub fn find(&self, id: &str) -> Option<...>;   // 按 ID 查找
    pub fn install(&mut self, skill: WritingSkill); // 新增/覆盖自定义
    pub fn delete(&mut self, id: &str);            // 删除自定义
    pub fn save(&self);                             // 持久化
}
```

---

## 7. 存储迁移

在现有的 store.rs 新增：

```rust
// store.rs 现有结构扩展
pub fn save_writing_skill(&self, skill: &WritingSkill) -> Result<(), String>;
pub fn load_writing_skills(&self) -> Vec<WritingSkill>;
pub fn delete_writing_skill(&self, id: &str) -> Result<(), String>;
```

前端新增 Tauri 命令：

```rust
#[tauri::command]
fn list_writing_skills(state: ...) -> Vec<WritingSkill>;

#[tauri::command]
fn save_writing_skill(state: ..., skill: WritingSkill) -> Result<(), String>;

#[tauri::command]
fn delete_writing_skill(state: ..., id: String) -> Result<(), String>;
```

---

## 8. UI 方案概览

### 8.1 StartupSplash 改造

当前：
```
[写作风格 ▼]   [目标读者 ▼]   [字数 ____]   [AI 规划]
```

改造后：
```
[技能选择器 ──────────────────v]
│ 当前：通用写作（默认）        │
│ ┌─────────────────────────────┐ │
│ │ 📝 通用写作          ●    │ │
│ │ 🔬 学术严谨                │ │
│ │ 📢 博客口语                │ │
│ │ ✍️ 创意文学                │ │
│ │ 📱 自媒体爆款              │ │
│ │ 💻 技术教程                │ │
│ │ 📦 商业文案                │ │
│ │ 📰 新闻报道                │ │
│ │ ─── 自定义 ───             │ │
│ │ 🎯 我的标题风格            │ │
│ │ ─────────────────────────── │ │
│ │ [+ 创建新技能]             │ │
│ └─────────────────────────────┘ │
└──────────────────────────────────┘

[目标读者 ▼]   [字数 ____]   [AI 规划]
```

### 8.2 技能管理页面（Settings 内）

- 列出所有技能（内置只读 + 自定义可编辑）
- 自定义技能编辑表单：
  - 名称、描述
  - 各阶段 systemPrompt（折叠/展开）
  - temperature、model 覆盖
  - 上下文来源勾选
  - 风格维度滑块

### 8.3 技能编辑表单布局

```
[技能名称]  _____________________________
[描述]     _____________________________
[图标]     [emoji 选择器]

[作用范围]  整篇文章  |  仅特定阶段 ▼

[阶段配置 ───────────────────────────────]
  ▼ 标题生成
    System Prompt: [多行文本区]
    Temperature: [0.7]  ← 滑块

  ▼ 简介生成
    System Prompt: [多行文本区]

  ▼ 正文写作
    System Prompt: [多行文本区]
    Temperature: [0.8]  ← 滑块

[上下文来源 ─────────────────────────────]
  ☑ 关联项目目录（推荐）
  ☐ 系列文章前文
  ☐ 自定义参考文本 [粘贴区]

[风格标签 ───────────────────────────────]
  正式度      [●━━━━━━━○] 口语化
  修辞密度    [○━━━●━━━○] 平实
  叙事性      [○━━●━━━━○] 说理
```

---

## 9. 与现有系统的关系

```
┌─────────────────────────────────────────────────┐
│                    WritingSkill                  │
│  （贯穿全文生成的风格控制）                       │
│  → 替代现有 tone 字段                             │
│  → 扩展 plan.ts 的 prompt 生成                    │
│  → 管理上下文注入                                 │
└────────────────┬────────────────────────────────┘
                 │ 使用
┌────────────────▼────────────────────────────────┐
│                 QuickPrompts                     │
│  （旧 skill.ts 中的快捷操作）                     │
│  → rewrite / polish / expand / translate ...     │
│  → 保持现状不改，但不归入 WritingSkill           │
│  → 后续可简化为纯前端配置                         │
└─────────────────────────────────────────────────┘
```

**互斥关系**：一个文章实例只能应用一个 WritingSkill（整篇技能）或一个阶段技能。不能同时叠加多个整篇技能。

---

## 10. 实施路线（已实现 ✅）

### Phase 1 ✅：类型定义 + 内置预设（纯前端）
- WritingSkill TypeScript 类型定义已完成
- 9+ 个内置预设（通用写作 / 学术严谨 / 博客口语 / 创意文学 / 自媒体爆款 / 技术教程 / 商业文案 / 新闻报道 / 营销文案 / 产品文档 / 书评影评）已实现
- 新增 3 种内置技能：营销文案、产品文档、书评影评（v1.4.0）

### Phase 2 ✅：接入 plan.ts
- PlanInput 新增 skillId、prefilledTitle、prefilledDescription 字段
- plan.ts 各函数读取技能配置替换固定 prompt
- 向后兼容：无 skillId 时用默认"通用写作"
- 预填标题/简介跳过 AI 生成（v1.7.0）

### Phase 3 ✅：StartupSplash 改造
- 技能选择器组件已实现
- AI 工具栏增加写作风格快速切换下拉菜单
- 技能卡片显示维度进度条可视化
- 工具调用进度展示重构为可折叠卡片设计（v1.7.1）

### Phase 4 ✅：存储 + 自定义编辑
- 设置页面的技能管理 UI 已实现
- 自定义技能 CRUD 支持
- 文章级样式通过 ArticleContext 独立持久化

### Phase 5 ⬜：上下文感知（部分实现）
- contextSources 类型已定义
- 项目/系列上下文的自动收集与注入已实现
- 合集关联文件夹的项目上下文注入已可用

### Phase 6 ⬜：阶段技能支持（待实现）
- scope: phase 的完整支持
- 阶段级技能独立作用的逻辑有待开发

---

## 11. 未解决问题 / 待讨论

1. **技能组合**：未来是否支持多个阶段技能叠加到不同阶段？（如：标题用"标题生成器" + 正文用"学术严谨"）
2. **技能分享**：是否支持导出/导入自定义技能（JSON 格式）？
3. **社区预设**：是否需要一个预设库让用户下载他人分享的技能？
4. **AI 辅助创建**：用户描述需求后，AI 自动生成技能配置？
5. **动态维度标签**：风格维度是固定字段还是用户可新增的？

Phase 1-4 已实现，上述问题已在后续迭代中逐步解决。
