# 09 — 技能系统缺陷与重构方案

> 关联: INDEX.md, 06-context-planner.md, 07-new-skills.md

---

## 一、当前缺陷

### 🔴 缺陷 1：两套平行技能体系完全脱节

**Rust 端** (`skill.rs`) 和**前端端** (`writingSkill/`) 各自定义了完全不同的技能：

```
Rust builtin_skills() (14个)             前端 getBuiltinSkills() (10个)
─────────────────────                    ────────────────────────
continue-writing                          general
rewrite                                   academic
polish                                    blog
translate                                 creative
academic                                  media-viral
creative                                  tech-tutorial
summary                                   business
outline                                   news
novel                                     marketing
headline                                  product-doc
email                                     review
keyword-extract
readability
citation
```

**命名不同**（`continue-writing` vs `general`）、**数量不同**、**用途不同**（Rust 偏向功能命令，前端偏向写作调性）。两套之间**没有任何同步机制**——前端调用时不知道 Rust 端注册了什么，Rust 执行时也不知道前端传了什么技能配置。

### 🔴 缺陷 2：类型定义双轨不一致

```rust
// Rust Skill 结构
pub struct Skill {
    pub name: String,
    pub description: String,
    pub body: String,                    // Markdown prompt body
    pub scope: SkillScope,              // Builtin | Global | Custom | Project
    pub run_as: RunAs,                  // Inline | Subagent
    pub allowed_tools: Vec<String>,     // 纯字符串列表，非类型安全
    pub model: Option<String>,
    pub effort: Option<String>,
    pub enabled: bool,
}
```

```typescript
// 前端 WritingSkill 结构
interface WritingSkill {
  id: string;                           // 和 Rust 的 name 不对应
  name: string;
  configs: Partial<Record<SkillPhase, PhaseConfig>>;  // Rust 无此字段
  contextSources: ContextSource[];      // Rust 无此字段
  dimensions: StyleDimension[];         // Rust 无此字段
  tools?: ToolDeclaration[];            // 从未被使用
  builtin: boolean;
  // ...还有 icon, phase, scope 等
}
```

**后果**：前端配置的 `configs`（每阶段的 system prompt/temperature）**无法传递到 Rust 端**，agent 执行时用的是 Rust 端独立的 `body` 字段——两套 prompt 并行运行。

### 🔴 缺陷 3：`agent.rs` 只有硬编码执行路径

```rust
// agent.rs — 没有任何灵活路由
pub async fn execute_agent(/* ... */) -> Result<AgentResult, String> {
    let system_prompt = build_agent_prompt(skill, context);  // 固定模板
    let user_prompt = build_user_prompt(context);
    // 不支持 tool calling
    // 不支持动态选择模型
    // 不支持 ContextPlanner
    // steps 永远返回 ["分析请求", "执行写作"]
}
```

### 🟡 缺陷 4：前端 `tool_call` 引擎和 Rust agent 是两套

前端 `agentEngine.ts` 有完整的 tool calling loop（支持 `read_project_files` / `list_project_files` / `search_project_files`），但 Rust `agent.rs` 的 `execute_agent` 完全不支持 tools。前后端 agent 执行逻辑重复。

### 🟡 缺陷 5：`allowed_tools` 是纯字符串

```rust
allowed_tools: vec!["read_document".into(), "write_document".into()]
```
应该用枚举代替：

```rust
#[derive(Debug, Clone, PartialEq)]
pub enum AgentTool {
    ReadDocument,
    WriteDocument,
    SearchDocument,
    ReadProjectFiles,
    ListProjectFiles,
    SearchProjectFiles,
    GitDiff,
    VectorSearch,
}
```

### 🟡 缺陷 6：Skill 定义和 ContextPlanner 不关联

`ContextSource` 类型定义在前端：

```typescript
interface ContextSource {
  type: "project" | "series" | "linked_folder" | "custom_text";
  label: string;
  required: boolean;
  maxLength?: number;
}
```

但 `ContextPlanner`（06-context-planner.md）的 `ContextPlan.requiredContexts` 用的是另一组 source 类型（`git_diff` / `ast_symbols` / `config_file` / `vector_search` / `article_series` / `publish_history`）。两者断层，skill 声明了需要什么上下文，planner 不知道。

---

## 二、重构方案：统一技能契约

### 核心思路：定义一个跨前后端的统一契约

```
Shared Skill Contract (docs/plan/SKILL-CONTRACT.md)
    │
    ├── Rust: impl 该契约的 struct + serialization
    ├── Frontend: 生成该契约的 builder + 双向同步
    └── ContextPlanner: 根据契约的 contextSources 生成 ContextPlan
```

### 第 1 步：统一类型定义（以 Rust 为权威）

```rust
// skill.rs — 统一的 Skill 定义

/// 工具能力枚举（类型安全）
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ToolCapability {
    ReadDocument,
    WriteDocument,
    SearchDocument,
    ReadProjectFiles,
    ListProjectFiles,
    SearchProjectFiles,
    GitDiff,
    VectorSearch,
    CallWebSearch,
}

/// 语境来源（和 ContextPlanner 共用）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillContextSource {
    pub source_type: ContextSourceType,
    pub label: String,
    pub required: bool,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ContextSourceType {
    Project,
    Series,
    LinkedFolder,
    CustomText,
    GitDiff,
    AstAnalysis,
    VectorSearch,
    PublishHistory,
}

/// 写作阶段配置（分 phase prompt = 前端独有的概念）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhaseConfig {
    pub phase: SkillPhase,
    pub system_prompt: String,
    pub temperature: Option<f32>,
    pub model: Option<String>,
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum SkillPhase {
    Title,
    Description,
    Outline,
    Tags,
    Writing,
}

/// 统一 Skill 定义
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnifiedSkill {
    // 基本信息
    pub name: String,
    pub description: String,
    pub icon: String,
    
    // 执行配置
    pub body: String,                     // 系统 prompt body（核心指令）
    pub run_as: RunAs,                    // Inline | Subagent
    pub allowed_tools: Vec<ToolCapability>,
    pub phase_configs: Vec<PhaseConfig>,   // 前端 phase prompt（Rust 可选忽略）
    
    // 上下文需求
    pub context_sources: Vec<SkillContextSource>,
    
    // 模型配置
    pub model: Option<String>,
    pub effort: Option<EffortLevel>,
    
    // 元信息
    pub scope: SkillScope,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum EffortLevel {
    Low,
    Medium,
    High,
}
```

### 第 2 步：前端与 Rust 合并技能定义

```typescript
// writingSkill/types.ts — 改写为对应 Rust 结构

export type ToolCapability =
  | "read_document" | "write_document" | "search_document"
  | "read_project_files" | "list_project_files" | "search_project_files"
  | "git_diff" | "vector_search" | "call_web_search";

export interface UnifiedSkill {
  id: string;
  name: string;
  description: string;
  icon: string;
  body: string;
  runAs: "inline" | "subagent";
  allowedTools: ToolCapability[];
  phaseConfigs: PhaseConfig[];
  contextSources: ContextSource[];
  model?: string;
  effort?: "low" | "medium" | "high";
  scope: "builtin" | "global" | "custom" | "project";
  enabled: boolean;
  builtin: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### 第 3 步：合并内置技能（消除双轨）

```
当前：14 个 Rust 技能 + 10 个前端技能 = 24 个
重构后：15 个统一技能 = 一次定义，前后端共用
```

统一技能的来源 = 一个 JSON 文件或一个 Rust `const` 数组，两端共享相同的 schema：

```rust
// 所有内置技能在 skill.rs 中统一注册
pub fn unified_builtin_skills() -> Vec<UnifiedSkill> {
    vec![
        // 1. 续写（偏向功能命令）
        unified("continue-writing", "续写", "从光标位置继续写作...")
            .run_as(RunAs::Inline)
            .tools([ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        
        // 2. 通用写作（偏向写作调性，含 phase prompt）
        unified("general", "通用写作", "平衡得体的通用写作风格...")
            .run_as(RunAs::Subagent)
            .tools([ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .phases([
                PhaseConfig { phase: SkillPhase::Title, system_prompt: "...", temperature: 0.7 },
                PhaseConfig { phase: SkillPhase::Writing, system_prompt: "...", temperature: 0.7 },
            ])
            .build(),
        
        // 后续所有 ...
    ]
}
```

前端通过 IPC 获取这个列表：

```typescript
// frontend 不再自行定义内置技能
const builtinSkills = await tryInvoke<UnifiedSkill[]>(TauriCommands.ListSkills);
```

### 第 4 步：`agent.rs` 支持 Tool Calling + ContextPlan

```rust
pub async fn execute_agent_v2(
    skill: &UnifiedSkill,
    config: &ProviderConfig,
    context: &AgentContext,
    plan: &ContextPlan,        // 新增：由 ContextPlanner 生成
    on_token: Option<TokenCallback>,
) -> Result<AgentResult, String> {
    // 1. 根据 ContextPlan 构建精准 prompt
    let system_prompt = build_precise_prompt(skill, context, plan);
    let messages = build_messages(system_prompt, context);
    
    // 2. 如果有 tools，启用 tool calling
    let tools = if skill.allowed_tools.is_empty() {
        None
    } else {
        Some(build_tool_definitions(&skill.allowed_tools, plan))
    };
    
    // 3. 根据 effort 选择模型
    let model = skill.model.clone().unwrap_or(config.model.clone());
    
    let req = ChatRequest {
        provider_id: config.id.clone(),
        model,
        messages,
        temperature: skill_effort_to_temp(&skill.effort),
        max_tokens: Some(8192),
        stream: on_token.is_some(),
        tools,
        tool_choice: None,
    };
    
    // 4. 执行 tool loop 或直接返回
    execute_with_tool_loop(config, req, plan, on_token).await
}
```

### 第 5 步：ContextPlanner 关联 skill.contextSources

```typescript
function planContext(
  userInput: string,
  skill: UnifiedSkill,
  projectCtx: ProjectContext | null,
): ContextPlan {
  // 规则引擎匹配意图
  for (const pattern of INTENT_PATTERNS) {
    if (matchKeywords(userInput, pattern.keywords)) {
      return pattern.plan;
    }
  }
  
  // 降级：根据 skill 声明的 contextSources 生成默认 plan
  const contexts = skill.contextSources.map(source => {
    switch (source.sourceType) {
      case "project": return mkContextItem("ast_symbols", "full_project", 2000);
      case "git_diff": return mkContextItem("git_diff", "changed_files", 3000);
      case "vector_search": return mkContextItem("vector_search", "related_only", 1000);
      // ...
    }
  });
  
  return {
    intent: "skill_default",
    requiredContexts: contexts,
    suggestedTools: skill.allowedTools,
    priorityFiles: [],
    skipSections: [],
  };
}
```

---

## 三、实施步骤

| 步骤 | 内容 | 涉及文件 | 量级 |
|------|------|---------|------|
| 1 | 定义 `UnifiedSkill` + 枚举类型 | `skill.rs`, `types.ts` | 中 |
| 2 | 合并 `builtin_skills()` 和 `getBuiltinSkills()` 为一套 | `skill.rs` | 大 |
| 3 | 前端改为从 IPC 获取技能列表 | `storage.ts`, `builtins.ts` | 中 |
| 4 | 用枚举替换 `allowed_tools` 字符串 | `skill.rs` | 小 |
| 5 | `agent.rs` 支持 tool calling 和 ContextPlan | `agent.rs` | 大 |
| 6 | ContextPlanner 关联 skill.contextSources | `contextPlanner.ts` | 中 |
| 7 | 废弃前端独立 `writingSkill/` 中的冗余代码 | 清理 | 小 |
