# WritingSkill（写作技能）— 设计文档

> 版本: v0.3.0-draft
> 状态: 设计阶段
> 关联: DESIGN.md, DESIGN-PROJECT-WRITING.md, plan.ts, skill.ts

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
    你是一位资深中文写作者。根据文章规划和当前章节信息，撰写该章节的完整内容。
    段落之间用空行分隔，适当使用加粗、引用等 Markdown 格式增加可读性。
    内容要具体充实，有细节、例子或数据支撑。
```

### 4.2 学术严谨

```
name: "学术严谨"
scope: full
contextSources: []
dimensions: [{ 正式度: 9 }, { 修辞密度: 3 }, { 叙事性: 2 }]
temperature: 0.5
configs:
  title.systemPrompt: >
    你是一位学术标题专家。生成严谨、准确的学术标题。
    标题应直接反映研究内容和结论，避免文学修辞。
    控制在 15-25 字，使用规范的学术术语。
  writing.systemPrompt: >
    你是一位学术写作专家。遵循以下规则：
    - 使用客观、中立的语气，避免主观评价和情感化表达
    - 每个论点需有论据或引用支撑，论证逻辑严密
    - 使用规范的学术术语，定义清晰
    - 段落结构：主题句 → 展开论述 → 小结/过渡
    - 避免口语化表达、修辞问句、感叹号
    - 引用格式规范，数据来源明确
```

### 4.3 博客口语

```
name: "博客口语"
scope: full
dimensions: [{ 正式度: 3 }, { 修辞密度: 4 }, { 叙事性: 6 }]
temperature: 0.8
configs:
  writing.systemPrompt: >
    以轻松自然的博客风格撰写内容。
    - 口语化但不随意，保持可读性
    - 段落短小精悍，3-5 句一段
    - 有明确的观点和态度
    - 适当使用设问句与读者互动
    - 开头要有吸引力，结尾要有总结或行动号召
```

### 4.4 创意文学

```
name: "创意文学"
scope: full
dimensions: [{ 正式度: 4 }, { 修辞密度: 9 }, { 叙事性: 8 }]
temperature: 0.9
configs:
  writing.systemPrompt: >
    以文学创作的方式撰写内容。
    - 使用文学性语言，注重修辞手法（比喻、拟人、排比等）
    - 控制节奏和韵律，长短句交替使用
    - 注重画面感和感染力，五感描写
    - 避免陈词滥调和空洞套话
    - 细节描写服务于氛围和主题
```

### 4.5 自媒体爆款

```
name: "自媒体爆款"
scope: full
dimensions: [{ 正式度: 2 }, { 修辞密度: 6 }, { 叙事性: 7 }]
temperature: 0.85
configs:
  title.systemPrompt: >
    生成吸引眼球的自媒体标题。
    - 可使用数字、悬念、冲突、反差等手法
    - 控制在 15-25 字
    - 准确反映内容，不标题党
    - 可适当使用情绪化词汇
  writing.systemPrompt: >
    以自媒体爆款风格写作：
    - 开头 100 字内抓住注意力
    - 段落短（2-4 句），多用换行制造节奏
    - 有金句意识，每段至少一句可截图传播
    - 多用设问、反问制造互动感
    - 适当使用加粗强调关键观点
    - 结尾引导互动（点赞/评论/转发）
```

### 4.6 技术教程

```
name: "技术教程"
scope: full
contextSources: [{ type: "project", label: "关联项目目录", required: false }]
dimensions: [{ 正式度: 6 }, { 修辞密度: 3 }, { 叙事性: 3 }]
temperature: 0.6
configs:
  writing.systemPrompt: >
    以技术教程风格写作：
    - 步骤清晰，循序渐进
    - 代码示例可运行、有注释
    - 解释"为什么"而不只是"怎么做"
    - 指出常见坑点和注意事项
    - 语言准确但不晦涩
    - 使用规范的代码块和终端格式
```

### 4.7 商业文案

```
name: "商业文案"
scope: full
dimensions: [{ 正式度: 6 }, { 修辞密度: 7 }, { 叙事性: 5 }]
temperature: 0.75
configs:
  writing.systemPrompt: >
    以商业文案风格写作：
    - 以用户痛点和需求为切入点
    - 突出价值主张和差异化优势
    - 使用有说服力的语言，数据支撑
    - 结构清晰：吸引 → 说服 → 转化
    - 有明确的行动号召（CTA）
    - 避免空洞的营销套话
```

### 4.8 新闻报道

```
name: "新闻报道"
scope: full
dimensions: [{ 正式度: 8 }, { 修辞密度: 3 }, { 叙事性: 5 }]
temperature: 0.5
configs:
  writing.systemPrompt: >
    以新闻报道风格写作：
    - 倒金字塔结构：最重要的信息在最前面
    - 客观中立，避免主观评价
    - 5W1H 要素齐全（何人、何事、何时、何地、为何、如何）
    - 引用可靠来源
    - 段落短小，信息密度高
    - 标题概括核心事实
```

### 4.9 阶段技能示例

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
~/.aiwriter/style-templates/
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
- 用户自定义：localStorage 键 `aiwriter-custom-skills`

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

## 10. 实施路线

### Phase 1：类型定义 + 内置预设（纯前端）
- 定义 WritingSkill TypeScript 类型
- 编写 8 个内置预设
- 不修改现有代码，仅产出类型

### Phase 2：接入 plan.ts
- PlanInput 新增 skillId 字段
- plan.ts 各函数读取技能配置替换固定 prompt
- 向后兼容：无 skillId 时用默认"通用写作"

### Phase 3：StartupSplash 改造
- 技能选择器组件
- 替换旧的 tone 下拉框

### Phase 4：存储 + 自定义编辑
- StyleTemplateStore（Rust）
- 自定义技能 CRUD 命令
- 设置页面的技能管理 UI

### Phase 5：上下文感知
- skill 声明 contextSources
- 自动收集项目/系列/目录上下文并注入

### Phase 6：阶段技能支持
- scope: phase 的完整支持
- 选择阶段技能后在特定阶段生效

---

## 11. 未解决问题 / 待讨论

1. **技能组合**：未来是否支持多个阶段技能叠加到不同阶段？（如：标题用"标题生成器" + 正文用"学术严谨"）
2. **技能分享**：是否支持导出/导入自定义技能（JSON 格式）？
3. **社区预设**：是否需要一个预设库让用户下载他人分享的技能？
4. **AI 辅助创建**：用户描述需求后，AI 自动生成技能配置？
5. **动态维度标签**：风格维度是固定字段还是用户可新增的？

这些问题不影响 Phase 1-3，可在后续阶段讨论。
