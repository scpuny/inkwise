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

## StartupSplash 工具事件 UI（v1.7）

StartupSplash 在 AI 写作阶段展示文件读取进度，v1.7 重构为可折叠卡片设计：

### 组件结构

```
startup-splash__tool-events-card
├── card-header（可点击折叠/展开）
│   ├── card-title（图标 + "项目文件读取" + 状态徽章）
│   └── card-toggle（ChevronDown / ChevronRight）
├── card-body（可滚动事件列表）
│   ├── tool-event-item--pending（Loader2 旋转图标 + "执行中…"）
│   ├── tool-event-item--done（Check 图标 + 文件名）
│   └── tool-event-item--error（AlertCircle 图标 + 错误信息）
│   └── card-status（底部状态栏："N 个任务执行中…"）
└── card-summary（折叠时显示的摘要条）
    ├── pending 时：旋转图标 + "N 个任务执行中"
    └── 全部完成时：对勾 + "全部完成（N 个任务）"
```

### 行为规则

- **写作阶段自动展开**：当 `planState === "writing"` 且有新事件时 `toolEventsCollapsed` 自动设为 false
- **状态配对**：`tool_start` 和 `tool_end` 通过 `toolCallId` 配对，配对后标记为 done
- **实时计数**：状态徽章显示 `doneCount/totalCount`
- **Auto-scroll**：新事件到达时自动滚动到底部
- **折叠摘要**：折叠时显示进度摘要，不占空间

### 使用场景

- AI 写作阶段展示文件读取进度
- AI 规划阶段展示工具调用记录
- 用户可手动折叠/展开控制可见性

## 数据流

```
用户触发技能 → AgentProvider.sendMessage()
  → AgentSession 管理消息历史
  → AI API 调用（streaming）
  → 流式回写到当前 session → AgentPanel 渲染
```
