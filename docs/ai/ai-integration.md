# AI 集成架构

> 版本: v1.0 | 关联: overview.md, ai/WRITING-SKILL-DESIGN.md

---

## 1. 多提供商架构

内置三个 AI 提供商 + 自定义 OpenAI 兼容 API：

| 提供商 | 模型 | 默认模型 |
|--------|------|---------|
| OpenAI | gpt-4o, gpt-4o-mini, gpt-4-turbo | gpt-4o |
| Anthropic | claude-3.5-sonnet, claude-3-haiku | claude-3.5-sonnet |
| DeepSeek | deepseek-chat, deepseek-coder | deepseek-chat |
| 自定义 | 任意 OpenAI 兼容 API | — |

## 2. 调用路径

```
前端操作
  │
  ├─ AI Dock（侧栏自动分析）
  │   └─ AIDock.tsx → 静态规则分析 → 展示建议
  │
  ├─ AI Bar（底部指令条）
  │   └─ AIBar.tsx → lib/ai/ai.ts → Rust ai.rs → HTTP API → 流式/完整响应
  │
  └─ Skill Agent（意图操作）
      └─ EditorPane → lib/skill.ts → Rust skill.rs + agent.rs → ai.rs → HTTP
```

## 3. 前端 AI 层（src/lib/ai/）

| 文件 | 职责 |
|------|------|
| `ai.ts` | AI API 调用封装，消息构建，重试逻辑 |
| `plan.ts` | 文章规划/生成管线，WritingSkill 注入 |
| `writingSkill/` | 写作技能类型定义、内置预设、验证 |

### 3.1 ai.ts 核心接口

```typescript
async function chatCompletion(
  messages: Message[],
  options?: ChatOptions,
): Promise<string>;

async function chatCompletionStream(
  messages: Message[],
  options?: ChatOptions & { onToken: (token: string) => void },
): Promise<string>;
```

- 自动读取当前启用的 Provider 配置
- 支持流式 token 回调
- 网络错误自动重试（最多 3 次）
- 超时保护（30s）

### 3.2 plan.ts 管线

```
用户输入 + WritingSkill 选择
  │
  ├─ generateTitle() → 生成标题（如有 prefilledTitle 则跳过 AI）
  ├─ generateDescription() → 生成简介（如有 prefilledDescription 则跳过 AI）
  ├─ generateOutline() → 生成章节级大纲（支持多种 AI 输出格式解析）
  ├─ generateTags() → 生成标签
  └─ generateFullArticleWithTools() → 使用 AgentEngine 逐章生成正文（带文件读取工具调用）
```

每个阶段独立读取 WritingSkill 的 systemPrompt 和 temperature 配置。

### 新增特性（v1.7）

- **预填标题/简介**：系列规划场景下，`PlanInput.prefilledTitle` 和 `PlanInput.prefilledDescription` 可跳过 AI 生成步骤，保持系列文章标题一致性
- **大纲解析增强**：`parseOutline()` 支持 Markdown 标题（`##`）、无序列表（`-`）、中文编号（`1、`）等多种 AI 输出格式
- **文件读取工具调用**：`generateFullArticleWithTools()` 使用 AgentEngine 驱动，在写作过程中可调用 `read_project_files`、`list_project_files`、`search_project_files` 获取项目代码

### 重试机制增强

写作/审阅阶段重试时，保留已有内容重新执行写作阶段，而非从头规划。重试时自动恢复项目上下文、系列上下文、合集关联文件夹等配置。

## 4. Rust AI 层（src-tauri/src/ai.rs）

| 功能 | 说明 |
|------|------|
| `chat_stream` Tauri 命令 | 流式聊天，前端通过事件监听逐 token 接收 |
| HTTP 客户端 | reqwest 0.12，支持 OpenAI/Anthropic/DeepSeek API 格式 |
| 错误处理 | API 错误 → 中文可读错误信息 |
| 超时/重试 | 30s 超时，网络错误自动重试 |

## 5. Agent 执行（src-tauri/src/agent.rs）

```
用户意图（润色/改写/翻译等）
  │
  ├─ skill.rs 查找 Skill 定义
  ├─ agent.rs 构建结构化 Prompt（Skill body + 文档上下文 + 项目上下文）
  ├─ ai.rs 调用 AI API
  └─ 返回 AgentResult { content, steps }
```

### 5.1 上下文注入

Agent 自动收集以下上下文注入 prompt：

| 来源 | 说明 |
|------|------|
| 文章正文 | 当前文档全部内容 |
| 选中文本 | 用户选中的部分 |
| WritingSkill | 当前写作风格配置（systemPrompt, temperature） |
| ArticleContext | 文章样式配置（字体、字号、主题色） |
| ProjectContext | 关联目录的项目结构信息 |

## 6. QuickPrompts（快捷技能）

8 个保留的轻量级快捷操作（不归入 WritingSkill 体系）：

| 技能 | 说明 |
|------|------|
| polish | 润色文本，使语言流畅自然 |
| rewrite | 改写选中文本，提升表达质量 |
| translate | 翻译文本（中→EN / EN→中） |
| expand | 扩写段落，补充论据细节 |
| continue-writing | 从光标位置继续写作 |
| proofread | 语法校对、错别字检查 |
| paraphrase | 同义改写，保留原意改变句式 |
| summary | 生成摘要 |

---

> 关联文档: [写作技能设计](WRITING-SKILL-DESIGN.md) | [技能架构评估](SKILL-ARCH-REVIEW.md) | [存储架构](../storage/storage-architecture.md)
