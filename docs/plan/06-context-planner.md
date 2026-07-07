# 06 — Context Planner：按意图预检 + 精准注入

> 关联: 04-query-ast.md, 05-vector-embedding.md, 07-new-skills.md

---

## 动机

当前 agent 将所有项目上下文一股脑塞给 AI：

```rust
// agent.rs - 当前做法
fn build_agent_prompt(skill, context) {
    prompt += project_context;   // 整个项目的结构 + 符号 + 依赖
    prompt += document_content;  // 整篇文章
    prompt += user_input;        // 用户输入
    
    // 问题：上下文窗口浪费、无关的符号干扰 AI
}
```

**目标**：根据用户意图，只注入最相关的上下文。

---

## 设计：三层预检

```
用户输入
    │
    ▼
第1层: 关键词规则引擎（轻量，零延迟）
    │  "变动/更新/修改/重构" → git diff + 变更符号
    │  "架构/设计"          → 项目结构 + 配置
    │  "发布/上线"          → changelog + 发布历史
    │
    ├── 能匹配 → 直接输出 ContextPlan
    │
    └── 无法匹配 → 降级到第2层
          │
          ▼
第2层: 向量语义检索（慢但泛化）
    │  用户输入 → embedding → 搜索最相关的项目块
    │  → 返回 Top-5 上下文项
    │
第3层: 小模型预检（最智能）
    │  用户输入 + 项目概览 + 第1层规则结果 + 第2层向量结果
    │  → 小模型 (gpt-4o-mini) 合并分析
    │  → 输出完整 ContextPlan
```

### ContextPlan 数据结构

```typescript
interface ContextPlan {
  intent: string;                         // 识别的意图
  requiredContexts: ContextItem[];         // 需要注入的上下文
  suggestedTools: string[];                // 建议使用的工具
  priorityFiles: string[];                 // 需要优先读取的文件
  skipSections: string[];                  // 不需要注入的部分
}

interface ContextItem {
  source: 'git_diff' | 'ast_symbols' | 'config_file' | 
         'vector_search' | 'article_series' | 'publish_history';
  scope: 'changed_files' | 'full_project' | 'related_only';
  maxTokens: number;
  priority: number;   // 1-5，5最高
}
```

### 规则引擎示例

```typescript
// src/lib/ai/contextPlanner.ts

const INTENT_PATTERNS: IntentPattern[] = [
  {
    keywords: ['变动', '更新', '修改', '重构', '修复', 'changelog', 'change'],
    plan: {
      intent: 'project_changelog',
      requiredContexts: [
        { source: 'git_diff', scope: 'changed_files', maxTokens: 2000, priority: 5 },
        { source: 'ast_symbols', scope: 'changed_files', maxTokens: 1000, priority: 4 },
        { source: 'config_file', scope: 'changed_files', maxTokens: 500, priority: 3 },
      ],
      suggestedTools: ['read_document', 'search_git_diff'],
      priorityFiles: [],
      skipSections: ['full_project_tree'],
    },
  },
  {
    keywords: ['架构', '设计', '模块', '概览', 'overview', 'structure'],
    plan: {
      intent: 'architecture_review',
      requiredContexts: [
        { source: 'config_file', scope: 'full_project', maxTokens: 2000, priority: 5 },
        { source: 'ast_symbols', scope: 'full_project', maxTokens: 3000, priority: 4 },
        { source: 'vector_search', scope: 'related_only', maxTokens: 1000, priority: 2 },
      ],
      suggestedTools: ['read_document', 'get_symbol_detail'],
      priorityFiles: ['README.md', 'package.json', 'Cargo.toml'],
      skipSections: ['git_diff'],
    },
  },
  {
    keywords: ['发布', '上线', '部署', 'release', 'deploy'],
    plan: {
      intent: 'release_notes',
      requiredContexts: [
        { source: 'git_diff', scope: 'full_project', maxTokens: 3000, priority: 5 },
        { source: 'publish_history', scope: 'full_project', maxTokens: 500, priority: 4 },
        { source: 'config_file', scope: 'full_project', maxTokens: 1000, priority: 3 },
      ],
      suggestedTools: ['read_document', 'search_git_diff', 'get_publish_history'],
      priorityFiles: ['CHANGELOG.md', 'package.json'],
      skipSections: ['vector_search'],
    },
  },
];
```

---

## 集成到 Agent 链路

```
用户输入 + 当前文档 → Context Planner
    │
    ▼
ContextPlan {
  intent: "project_changelog",
  requiredContexts: [git_diff, changed_symbols],
  suggestedTools: [read_document, search_git_diff],
  priorityFiles: [],
  skipSections: [full_project_tree]
}
    │
    ▼
Agent Prompt Builder（根据 ContextPlan 精准构建）
    │
    ├── 只注入 requiredContexts 中指定的项
    ├── 跳过 skipSections 中的项
    ├── 优先读取 priorityFiles
    └── 注入 suggestedTools 让 AI 知道能用什么
    │
    ▼
AI Response（上下文更精准，token 更少）
```

### 实现位置

```typescript
// src/lib/ai/contextPlanner.ts - 新文件
export function planContext(
  userInput: string,
  projectCtx: ProjectContext | null,
  articleCtx: ArticleCtx | null,
  skill: Skill | null,
): ContextPlan {
  // 1. 关键词规则匹配
  for (const pattern of INTENT_PATTERNS) {
    if (matchKeywords(userInput, pattern.keywords)) {
      return pattern.plan;
    }
  }
  
  // 2. 降级：根据技能匹配默认计划
  return getDefaultPlan(skill, projectCtx, articleCtx);
}
```

```rust
// agent.rs - 修改 build_agent_prompt
fn build_agent_prompt(
    skill: &Skill,
    context: &AgentContext,
    plan: &ContextPlan,  // 新增参数
) -> String {
    let mut prompt = String::new();
    
    // 按 ContextPlan 选择性注入
    if !plan.skip_sections.contains("project_context") {
        // 只注入 requiredContexts 中指定的源
        // ...
    }
    
    prompt
}
```

---

## 和向量检索的关系

```
用户输入 → Context Planner
    │
    ├── 规则匹配命中 → 直接输出 ContextPlan（零延迟）
    │
    └── 规则未命中 / 需要更多上下文
          │
          ▼
        向量检索: 用户输入 → embedding → 搜索 project_chunks / article_chunks
          │
          ▼
        向量结果合并到 ContextPlan.requiredContexts
```

---

## 实现步骤

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | 定义 `ContextPlan` 和 `IntentPattern` 类型 | 新文件 `src/lib/ai/contextPlanner.ts` |
| 2 | 实现关键词规则引擎 | 同上 |
| 3 | 改造 `build_agent_prompt` 接受 `ContextPlan` | `agent.rs` |
| 4 | 向量检索就绪后接入第2层 | `contextPlanner.ts` |
| 5 | 小模型预检作为第3层（未来） | `contextPlanner.ts` |
