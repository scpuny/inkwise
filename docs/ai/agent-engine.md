# Agent 编排引擎

> 版本: v1.4 | 位置: `src/lib/ai/agent.ts`, `src/lib/ai/plan.ts`, `src/lib/ai/articleBlueprint.ts`, `src/lib/ai/articleReview.ts`, `src/lib/ai/articleSessions.ts`

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
