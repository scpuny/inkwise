# Agent 编排引擎

> 版本: v1.7 | 位置: `src/lib/ai/agentEngine.ts`, `src/lib/ai/plan.ts`, `src/lib/ai/articleBlueprint.ts`, `src/lib/ai/articleReview.ts`, `src/lib/ai/articleSessions.ts`

---

## 概述

Agent 编排引擎是 AI 技能调度的核心，负责管理多轮对话的 session 生命周期、技能路由、文章蓝图生成与审阅。

## 模块职责

| 模块 | 职责 |
|------|------|
| `agent.ts` | Agent session 管理、技能路由、消息历史 |
| `plan.ts` | AI 写作规划生成 |
| `articleBlueprint.ts` | 文章蓝图（结构大纲）生成 |
| `articleReview.ts` | AI 审阅与评分 |
| `articleSessions.ts` | 文章级 session 持久化 |

## Agent Session 生命周期

```
创建 session → 设置技能上下文
  → 用户发送消息 → 追加到历史
  → AI 流式响应 → 追加到历史
  → 保存 session（自动/手动）
  → 支持恢复历史 session
```

## 技能路由

- 技能通过 `getSkillDisplayLabel()` 获取显示名
- 内置 8 种技能：续写、改写、润色、翻译、扩写、缩写、摘要、自定义
- 每种技能对应不同的 system prompt 和参数配置

## 蓝图与审阅

- `articleBlueprint.ts` — 根据用户描述生成文章大纲（标题、段落结构）
- `articleReview.ts` — 对已写内容进行 AI 审阅，返回评分和改进建议
- `articleSessions.ts` — 将 Agent session 关联到具体文章，支持多轮审阅迭代

## 文章规划管线（plan.ts）

### PlanInput 扩展

```typescript
interface PlanInput {
  inspiration: string;
  articleDescription?: string;
  tone?: string;
  targetAudience?: string;
  targetWordCount?: number;
  skillId?: string;
  projectContext?: string;
  projectName?: string;
  seriesContext?: string;
  collectionId?: string;
  linkedFolder?: string;
  prefilledTitle?: string;       // v1.7: 系列规划预填标题，跳过 AI 生成
  prefilledDescription?: string; // v1.7: 系列规划预填简介，跳过 AI 生成
}
```

`prefilledTitle` 和 `prefilledDescription` 由系列规划触发时自动传入。当 `prefilledTitle` 存在时，`generateTitle()` 直接返回预填值；同理 `prefilledDescription` 跳过 AI 生成步骤。这确保了系列文章标题的一致性。

### 大纲解析增强（v1.7）

`parseOutline()` 函数增强了 AI 输出格式的兼容性，支持多种解析模式：

| 格式 | 示例 |
|------|------|
| 标准编号 | `1. 标题 - 描述` |
| Markdown 标题 | `## 标题 - 描述` |
| 无序列表 | `- 标题 - 描述` |
| 中文编号 | `1、标题 - 描述` |

解析结果自动清洗 Markdown 加粗标记（`**`）等格式噪音。

### 文件读取摘要增强（agentEngine.ts）

`read_project_files` 工具调用结果现在报告文件读取统计：

- 成功/失败文件计数
- 总字符数
- 错误文件列表
- 示例：`"读取完成：12 个文件，2 个失败，共 45280 字符"`

### 写作/审阅阶段重试（EditorPane.tsx）

`handlePlanRetry` 增强了阶段感知能力：

- **writing/article-review 阶段重试**：保留已有内容，只重新执行写作阶段，不清除已保存的进度
- **planning/review 阶段重试**：从规划步骤重新开始（原有行为）
- 重试时自动恢复项目上下文、系列上下文、合集关联文件夹等配置
