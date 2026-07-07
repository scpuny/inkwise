# 13 — 写作业务模型重塑：Style / Action / Phase 三分离

> 关联: 09-skill-system-review.md, 12-feature-map.md

---

## 一、根本问题

当前 InkWise 把所有 AI 操作都叫 "skill"，但实际上**"skill"在两个完全不相关的语义间摇摆**：

| 使用场景 | 当前叫法 | 实际应该叫什么 | 示例 |
|---------|---------|--------------|------|
| 设置文章风格调性 | WritingSkill | **Style（风格）** | 学术严谨、自媒体爆款 |
| 对文本做单次操作 | Rust builtin skill | **Action（动作）** | 续写、改写、润色 |
| 分阶段生成文章 | plan.ts 调 configs | **Phase（阶段）** | title → desc → outline |
| 评估文章质量 | articleReview.ts | **Review（审阅）** | 5 维度评价 |

**"风格"和"动作"被硬塞进一个概念，导致三个后果：**

### 后果 1：风格一致性断裂

```
用户选"自媒体爆款"→ 生成标题 ✅ → 生成正文 ✅
          ↓
用户按 Ctrl+K → "润色这段"
          ↓
agent.rs 调用了 "polish" skill（动作）
          ↓
"polish" 的 body: "润色文本，修正语法问题"
          ↓
**不知道用户当前是"自媒体爆款"风格**
结果：润色后的文字变回了通用风格
```

### 后果 2：审阅不感知风格

```
用户用"自媒体爆款"风格写了一篇爆文
          ↓
generateArticleReview(content)
          ↓
评价维度: 开头/结构/内容/表达/格式（硬编码）
          ↓
不会检查"标题有没有钩子"、"段落节奏够不够快"
——这些都是"自媒体爆款"的关键指标
```

### 后果 3：分阶段流程和单独动作脱节

```
plan.ts 的分阶段生成用了 WritingSkill.configs（风格 phase prompt）
agent.ts 的单独动作执行用了 Rust skill.rs（动作 body）

两者用的是不同的 prompt 来源，
互相不知道对方的存在
```

---

## 二、正确业务模型

### 三分离设计

```
写作领域模型
│
├── 1. Style（写作风格） ← 贯穿全文的调性
│   ├── 定义：标题怎么写、正文什么节奏、用什么比喻
│   ├── 生效范围：整个文章生命周期
│   ├── 唯一 ID：每篇文章强制绑定一个 styleId
│   └── 示例：自媒体爆款、学术严谨、博客口语
│
├── 2. Action（写作动作） ← 单次操作
│   ├── 定义：对文本做什么操作
│   ├── 独立于风格，但执行时应传入当前 Style
│   ├── 同一 Style 的不同 Action 变体
│   └── 示例：续写、改写、润色、翻译、扩写
│
├── 3. Phase（写作阶段） ← 写作流程步骤
│   ├── 定义：文章生成的 pipeline 阶段
│   ├── 每个阶段使用 Style 对应的 prompt
│   └── 示例：title → description → outline → tags → writing
│
└── 4. Review（审阅） ← 质量评估
    ├── 定义：根据 Style 动态生成评价维度和权重
    ├── 不感知 Style 的审阅是空洞的
    └── 示例：自媒体爆款注重标题钩子/段落节奏
              学术严谨注重论据逻辑/引用规范
```

### 三者的调用链

```
创建文章
  │
  ├── [1] 用户选择 Style（如"自媒体爆款"）
  │       └── 写入 Blueprint.styleId（强制非空）
  │
  ├── [2] Phase 流程：plan.ts 按 Style.PhasePrompts 分阶段生成
  │       ├── title prompt    ← Style.title
  │       ├── description prompt ← Style.description
  │       ├── outline prompt  ← Style.outline
  │       ├── tags prompt     ← Style.tags
  │       └── writing prompt  ← Style.writing
  │
  ├── [3] 手动编辑/润色
  │       └── Action 执行时传入 Blueprint.styleId
  │             └── "按自媒体爆款的风格润色以下文字"
  │
  ├── [4] 审阅
  │       └── Review 拿到 Blueprint.styleId
  │             └── "自媒体爆款的评价标准：检查标题钩子、段落节奏、情绪张力"
  │             └── AI 按此标准动态生成审阅维度
  │
  └── [5] 发布
        └── Style.recommendedThemeId → 自动推荐头条默认主题
```

---

## 三、数据结构设计

### Style 定义

```typescript
interface WritingStyle {
  id: string;
  name: string;              // "自媒体爆款"
  description: string;
  icon: string;
  
  // 每个阶段的 prompt（Phase Prompts）
  prompts: {
    title: PhasePrompt;       // 生成标题的 prompt
    description: PhasePrompt; // 生成简介的 prompt
    outline: PhasePrompt;     // 生成大纲的 prompt
    tags: PhasePrompt;        // 生成标签的 prompt
    writing: PhasePrompt;     // 写正文的 prompt
  };
  
  // 动作变体（Action Prompts）—— 保持风格一致性
  // 当用户执行"润色"时，用这个 prompt 代替通用 prompt
  actionPrompts: {
    rewrite?: string;         // "以自媒体爆款风格改写以下文字..."
    polish?: string;          // "以自媒体爆款风格润色..."
    continue?: string;        // "以自媒体爆款风格续写..."
    expand?: string;
    shorten?: string;
  };
  
  // 不指定动作变体时，用这个兜底模板包裹通用 action
  // 例如: "你当前使用的写作风格是{name}，请保持{description}的风格特点"
  styleContextTemplate?: string;
  
  // 审阅标准
  reviewCriteria: ReviewCriteria;
  
  // 推荐的主题 ID
  recommendedThemeId?: string;
  
  // 视觉维度条
  dimensions: StyleDimension[];
}
```

### Action 定义

```typescript
// Action 不再是"skill"——它只是一个命令
interface WritingAction {
  id: string;                 // "polish" | "rewrite" | "continue" | ...
  name: string;               // "润色"
  description: string;
  icon: string;
  
  // 基础 prompt（不包含风格上下文）
  basePrompt: string;
  
  // 工具需求
  requiredTools: ToolCapability[];
  
  // 执行模式
  runAs: "inline" | "subagent";
}
```

### Blueprint 强制绑定 Style

```typescript
interface ArticleBlueprint {
  styleId: string;             // 不再是 optional! 强制绑定
  styleSnapshot: {             // 风格快照（风格定义以后变了也能还原）
    id: string;
    name: string;
    dimensions: StyleDimension[];
    prompts: Record<string, PhasePrompt>;  // 当时的完整 prompt
    actionPrompts: Record<string, string>;
  };
  // ...原有字段不变
}
```

---

## 四、执行逻辑变化

### 之前（混乱）

```typescript
// agent.ts
execute(input, options) {
  const intent = detectIntent(input);
  // intent 可以命中 "polish"（动作）或 "academic"（风格）
  // 两者都是 skill，后面不知道谁是谁
  const skill = findSkill(intent.skill);
  return agentEngine.runAgentLoop(skill, ...);
}
```

### 之后（清晰）

```typescript
// agent.ts
async execute(input, options) {
  const intent = detectAction(input);  // 只检测动作：rewrite/polish/translate/...
  
  // 从当前文章 Blueprint 获取绑定的 Style
  const blueprint = await loadBlueprint(articleId);
  const style = blueprint?.styleId 
    ? await findStyle(blueprint.styleId) 
    : null;
  
  // 组装 prompt：Action base + Style 上下文
  const prompt = style 
    ? buildStyledPrompt(intent.action, style, options.selectedText)
    : intent.action.basePrompt;
  
  return agentEngine.runAgentLoop(prompt, ...);
}
```

```rust
// agent.rs — 改写后
pub async fn execute_action(
    action: &Action,                       // 动作
    active_style: Option<&Style>,          // 当前文章风格
    config: &ProviderConfig,
    context: &AgentContext,
    on_token: Option<TokenCallback>,
) -> Result<AgentResult, String> {
    // 1. 构建系统 prompt
    let system_prompt = if let Some(style) = active_style {
        // 动作有风格变体吗？
        if let Some(action_prompt) = style.get_action_prompt(&action.id) {
            action_prompt.clone()
        } else {
            // 没变体：用兜底模板包裹
            format!("{}\n\n{}", 
                style.build_style_context_template(),
                action.base_prompt)
        }
    } else {
        action.base_prompt.clone()
    };
    
    // 2. 其余逻辑不变
    // ...
}
```

---

## 五、审阅改造

### 之前（硬编码）

```typescript
const REVIEW_DIMENSIONS = [
  "opening", "structure", "content", "expression", "formatting"
];
// 对所有文章一视同仁
```

### 之后（动态 + 风格感知）

```typescript
async function generateArticleReview(articleId, content, style?) {
  const systemPrompt = style 
    ? buildStyleAwareReviewPrompt(style)  // 动态生成维度和权重
    : buildGenericReviewPrompt();         // 降级到通用

  // Style 感知 prompt 示例：
  // "该文章使用了"自媒体爆款"风格，请特别注意：
  // 1. 标题是否包含钩子（设问/反差/数字）
  // 2. 段落节奏是否张弛有度（短段冲击、长段展开）
  // 3. 情绪张力是否足够
  // 4. 格式: 加粗/引用/列表使用是否恰当"
}
```

### applyOptimization 改造——逐段修复

```typescript
async function applyOptimization(articleId, content, review, style?) {
  // 收集所有"差"和"良"的维度
  const weakDimensions = Object.entries(review.dimensions)
    .filter(([_, d]) => d.rating !== "优")
    .map(([key, d]) => ({ key, ...d }));

  // 逐维度修复，而非一次性全量重写
  let currentContent = content;
  for (const dim of weakDimensions) {
    currentContent = await fixDimension(
      currentContent, dim, style
    );
  }
  return currentContent;
}

async function fixDimension(content, dimension, style?) {
  const prompt = style
    ? `请以${style.name}的风格，改进以下内容的「${getDimensionLabel(dimension.key)}」方面。`
    : `请改进以下内容的「${getDimensionLabel(dimension.key)}」方面。`;
  // + 该维度的具体建议
  // + 只修改相关段落，不改变其他部分
  return sendChat(/* ... */);
}
```

---

## 六、实施路径

| 步骤 | 内容 | 涉及文件 | 量级 |
|------|------|---------|------|
| 1 | 定义 `WritingStyle` 和 `WritingAction` 类型 | `types.ts` 新文件 | 中 |
| 2 | `ArticleBlueprint.skillId` 改为 `styleId: string`（强必填） | `articleBlueprint.ts` | 小 |
| 3 | 迁移现有 WritingSkill → Style（名称不变，结构重构） | `builtins.ts` | 中 |
| 4 | 迁移 Rust builtin_skills 中的动作 → Action 枚举 | `skill.rs` | 中 |
| 5 | 改造 `agent.ts` execute：Action + Style 上下文拼接 | `agent.ts` | 大 |
| 6 | 改造 `agent.rs` execute_action：接受 Style 参数 | `agent.rs` | 中 |
| 7 | 改造 `articleReview.ts`：动态维度 + 风格感知 | `articleReview.ts` | 中 |
| 8 | 改造 `applyOptimization`：逐段修复而非全量重写 | `articleReview.ts` | 中 |
| 9 | 添加 styleContextTemplate 兜底模板 | `types.ts` | 小 |
