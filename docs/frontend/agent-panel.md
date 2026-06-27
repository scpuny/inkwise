# AI Agent 面板

> 版本: v1.4 | 位置: `src/components/agent/`, `src/lib/ai/agent.ts`

---

## 概述

Agent 面板是用户与 AI 技能交互的统一入口，替代了原来的 AIDock 方案。所有 AI 技能的调用、结果展示、历史记录都在此集中管理。

## 组件结构

```
agent/
├── AgentPanel.tsx      # 主面板（Tab 容器：对话/历史/审阅）
├── AIBar.tsx           # AI 指令条（编辑器底部悬浮条）
├── AICommandBar.tsx    # AI 命令条（编辑器顶部）
├── AgentProvider.tsx   # React Context 提供者
├── HistoryPanel.tsx    # 历史会话列表
├── ReviewPanel.tsx     # 审阅面板
├── IntentMenu.tsx      # 意图菜单（快捷技能选择）
└── index.ts            # 模块导出
```

### AgentPanel

- 三个 Tab：chat（当前对话）、history（历史）、review（审阅）
- 通过 `AgentSession` 管理每个对话 session
- 展示技能名称、对话消息流、流式响应

### AIBar

- 编辑器底部悬浮，提供快速技能触发入口
- 支持续写、改写、润色、翻译、扩写、缩写、摘要、自定义技能
- 选中文本后自动显示可用操作

### HistoryPanel

- 按时间倒序显示历史 agent 会话
- 支持点击恢复历史 session

### ReviewPanel

- 对 AI 生成的计划/文章进行审阅
- 支持逐段确认/修改

## 数据流

```
用户触发技能 → AgentProvider.sendMessage()
  → AgentSession 管理消息历史
  → AI API 调用（streaming）
  → 流式回写到当前 session → AgentPanel 渲染
```
