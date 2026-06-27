# Rust 后端模块

> 版本: v1.0 | 位置: src-tauri/src/

---

## 模块总览

```
src-tauri/src/
├── main.rs               # 入口
├── lib.rs                # Tauri 命令注册
├── store.rs              # JSON 文件持久化（legacy）
├── db.rs                 # SQLite 持久层 + FTS5
├── ai.rs                 # AI API 调用（HTTP client）
├── skill.rs              # Skill 管理
├── agent.rs              # Agent 执行引擎
├── publisher/            # 多平台发布
│   ├── mod.rs
│   └── wechat.rs         # 微信公众号适配器
└── project_indexer.rs    # 项目代码扫描
```

---

## 1. lib.rs — 命令注册

所有 Tauri 命令的注册入口，约 50+ 个 invoke handler。

## 2. store.rs — JSON 持久化

原始持久化方案，所有数据存储在 JSON 文件中：

| 文件 | 用途 |
|------|------|
| `collections.json` | 合集与文章结构 |
| `providers.json` | AI 提供商配置 |
| `platforms.json` | 发布平台凭据 |

提供 `DataStore` 结构体，封装 JSON 的序列化/反序列化。

## 3. db.rs — SQLite 持久层

较新的持久化方案，逐步替代 JSON 文件：

- 数据库文件位于 `{app_data_dir}/inkwise.db`
- 启用 WAL 模式提升并发性能
- FTS5 全文检索
- Schema 版本管理，自动增量迁移

**核心表**：

| 表 | 用途 | 状态 |
|----|------|------|
| collections | 合集 | ✅ 生产中 |
| articles | 文章内容+元数据 | ✅ 生产中 |
| articles_fts | 全文索引（FTS5） | ✅ 生产中 |
| series_plans | 系列规划 | ✅ 生产中 |

## 4. ai.rs — AI API 调用

- HTTP 客户端使用 reqwest 0.12
- 支持 OpenAI / Anthropic / DeepSeek 三种 API 格式
- `chat_stream` 命令：SSE 流式响应
- 错误信息中文化（微信错误码等）

## 5. skill.rs — Skill 管理

- Skill 定义与持久化
- 内置 Skill + 自定义 Skill 支持
- 启用/禁用状态管理

## 6. agent.rs — Agent 执行引擎

```rust
pub struct AgentInput {
    pub skill_name: String,
    pub user_input: String,
    pub document_content: String,
    pub selected_text: String,
    // 自动注入：
    pub project_context: Option<String>,   // 关联目录项目结构
    pub article_style: Option<String>,     // 文章样式上下文
}
```

Agent 构建结构化 Prompt，调用 AI，返回 `AgentResult { content, steps }`。

## 7. publisher/ — 多平台发布

### 微信公众号 (`wechat.rs`)

| 流程 | 说明 |
|------|------|
| access_token | 自动获取/缓存/刷新（2h 有效期） |
| Markdown → HTML | 微信兼容 HTML 转换 |
| 图片上传 | 提取 Markdown 中图片 → 上传微信 CDN |
| 创建草稿 | POST draft/add |
| 发布草稿 | POST draft/publish |
| 错误处理 | token 过期自动刷新，图片失败跳过 |

### 平台支持

| 平台 | 状态 |
|------|------|
| 微信公众号 | ✅ 已实现 |
| 今日头条 | ⬜ 待实现 |

## 8. project_indexer.rs — 项目代码扫描

三层渐进扫描架构：

```
Level 1: std::fs 扫描（零依赖，保证可用）
  ├─ 目录结构（忽略 node_modules/.git/target）
  ├─ 关键配置文件内容
  ├─ 语言分布统计
  └─ 大文件仅记录行数

Level 2: tree-sitter 符号提取（待集成）
  ├─ 函数/类/接口定义 + 行号
  ├─ 导出符号列表
  └─ 模块导入关系

Level 3: CodeGraph SQLite 读取（可选增强）
  ├─ 检测 .codegraph/codegraph.db
  ├─ 读取 docstring/signature
  ├─ 读取调用链
  └─ 不存在则静默跳过
```

---

> 关联文档: [存储架构](../storage/storage-architecture.md) | [项目系列写作](DESIGN-PROJECT-WRITING.md) | [AI 集成](../ai/ai-integration.md)
