# 项目系列写作 — 设计文档

> 对应 DESIGN.md 第 10 节「未来规划」的核心功能扩展
> 版本: v0.2.0-draft | 依赖: Tauri 2 + CodeGraph 可选

---

## 1. 概述

合集关联本地代码目录后，通过代码扫描理解项目结构，支撑 AI 写出有深度、连贯的技术系列文章。这是 AiWriter 区别于通用写作工具的核心能力。

### 1.1 设计目标

- **开箱即用**：用户不需要安装任何额外工具即可使用核心功能
- **渐进增强**：用户已有的 CodeGraph 索引会被自动利用，越用越好
- **单一入口**：不搞模式切换，`+` 按钮走天下
- **系列连贯**：多篇文章共享项目上下文，风格、深度、术语保持一致

### 1.2 用户场景

| 用户 | 场景 | 示例 |
|------|------|------|
| 开发者 | 为自己的开源项目写系列教程 | "写 5 篇关于这个 NestJS 项目的架构、核心模块、部署" |
| 技术作者 | 为客户的代码库写技术文档 | "给我这个项目的概览，然后逐模块输出 API 文档" |
| 学习者 | 边学边写学习笔记 | "这个 React 项目用了哪些模式，逐一分析" |
| 普通用户 | 为任意目录内容做知识整理 | "这个文件夹里的文档帮我整理成系列笔记" |

---

## 2. 代码扫描架构（三层渐进）

```
Level 1: Rust std::fs 扫描（零依赖，保证可用）
  ├─ 目录结构（完整文件树，忽略 node_modules/.git/target）
  ├─ 关键配置文件内容（README / package.json / Cargo.toml / pyproject.toml）
  ├─ 文件语言分布统计
  └─ 大文件仅记文件名+行数，小文件可包含内容

Level 2: tree-sitter 符号提取（编译加入，无运行时依赖）
  ├─ 函数/类/接口/类型定义 + 行号
  ├─ 导出符号列表
  ├─ 模块导入关系（可绘制依赖图）
  └─ 语言支持：tsx / typescript / rust / python / go 等

Level 3: CodeGraph SQLite 读取（可选增强）
  ├─ 检测 .codegraph/codegraph.db
  ├─ 读取 nodes.docstring → 代码文档摘要
  ├─ 读取 edges.calls → 调用链分析
  ├─ 读取 files.node_count → 按文件复杂度排序
  └─ 不存在则静默跳过，不影响 1+2
```

### 2.1 分层策略

```
用户选择目录
       │
       ▼
    ┌─── 检测 .codegraph/codegraph.db ───┐
    │ 存在                            不存在 │
    ▼                                     ▼
Level 3 + Level 2 + Level 1         Level 2 + Level 1
(最丰富上下文)                        (够用的上下文)
       │                                     │
       └────────── 统一输出格式 ──────────────┘
                        │
                        ▼
               ProjectContext (结构化 JSON)
```

### 2.2 统一输出格式

```rust
#[derive(Serialize)]
struct ProjectContext {
    name: String,                    // 从 README 或目录名推断
    root_path: String,
    primary_language: Option<String>, // 从文件分布推断
    structure: Vec<FileNode>,        // 目录树（深度 ≤ 5）
    summary: ProjectSummary,         // 整体统计
    configs: Vec<ConfigFile>,        // 关键配置文件内容
    symbols: Vec<SymbolInfo>,        // 代码符号（Level 2+）
    imports: Vec<ImportEdge>,        // 模块依赖（Level 2+）
    codegraph_available: bool,       // 是否用了 Level 3
}

struct FileNode {
    name: String,
    path: String,
    is_dir: bool,
    language: Option<String>,
    size: u64,
    children: Vec<FileNode>,        // 仅 is_dir 时有
}

struct ProjectSummary {
    total_files: u32,
    total_dirs: u32,
    total_lines: u64,
    languages: Vec<LanguageStat>,    // 语言分布
    top_files: Vec<FileInfo>,       // 最大的 10 个文件
}

struct SymbolInfo {
    name: String,
    kind: String,                    // function / class / interface / struct / type_alias
    file_path: String,
    line: u32,
    is_exported: bool,
    docstring: Option<String>,
    signature: Option<String>,
}
```

### 2.3 缓存策略

```
持久化缓存（应用数据目录）:
  └─ project-context/{dir_hash}.json — 上次扫描的完整上下文
  └─ project-context/{dir_hash}.meta — 缓存时间 + 文件 hash 快照

命中策略:
  - 首次关联目录 → 全量扫描，写入缓存 → ~秒级
  - 再次打开合集 → 加载缓存（<10ms）
  - 手动「重新扫描」或检测到文件变更 → 增量扫描
  - 缓存永久有效，但超过 24 小时显示「建议重新扫描」提示
```

---

## 3. 数据模型扩展

### 3.1 Collection 扩展

```typescript
// 现有字段不变，新增：
export type Collection = {
  // ... 现有字段
  linkedFolder?: string;         // 已有
  linkedFolderScannedAt?: number; // 新增：上次扫描时间戳

  // 新增：系列规划
  seriesPlan?: SeriesPlan;
};

export type SeriesPlan = {
  id: string;
  createdAt: number;
  articles: SeriesArticle[];
};

export type SeriesArticle = {
  id: string;
  title: string;
  description: string;
  targetWordCount?: number;
  status: "planned" | "outlining" | "writing" | "complete";
  articleId?: string;        // 关联到实际文章的 id
};
```

### 3.2 新的存储实体

```
实体           存储方式                   说明
──────────────────────────────────────────────────────────
Collection     collections.json          已有，新增字段
SeriesPlan     series/{collectionId}.json 独立文件，不污染 Collection
Article        已有                      已有
Blueprint      已有                      已有
```

这样设计的原因：
- `SeriesPlan` 独立存储 → 不影响现有 Collection 结构的迁移
- 不往 `Collection.articles` 里塞系列规划信息 → 避免数据结构耦合
- `SeriesArticle.articleId` 在生成实际文章后才赋值 → 从规划到产物的可追溯

---

## 4. 前端交互设计

### 4.1 统一入口

```
CollectionTree → [+] 按钮
  ├── ✍️ 新建文章           ← 始终显示
  └── 📚 规划系列文章        ← 仅合集关联了目录时显示
                              └─ 已有系列规划时改为「📚 编辑系列规划」
```

StartupSplash（开始写作界面）：
- 当前合集有关联目录时，输入框下方显示标签：`📁 项目: 项目名称`
- 单篇写作自动注入项目上下文，不打断用户流程
- 用户感知不到「模式切换」，上下文存在但低调

### 4.2 关联目录设置

```
合集编辑弹窗（CollectionFormModal）新增区域：

  ┌─────────────────────────────────┐
  │ 📁 本地目录                      │
  │                                 │
  │ 未关联                           │
  │ [选择目录…]                      │
  │                                 │
  │ ── 或 ──                        │
  │                                 │
  │ 已关联: /Users/.../my-project    │
  │ [重新选择] [重新扫描] [取消关联]   │
  │ ✅ 扫描完成 — 共 128 个文件       │
  │    ├─ TypeScript  45 个         │
  │    ├─ Rust        23 个         │
  │    └─ JSON        12 个         │
  └─────────────────────────────────┘
```

右键菜单同步补充：

```
合集右键菜单:
  ├── 重命名
  ├── 关联本地目录...   ← 新增（或显示「重新扫描」）
  ├── 删除合集
  └── ……
```

### 4.3 系列规划流程

```
Step 1: 用户输入系列方向
  ┌────────────────────────────────────────────┐
  │ 📚 规划系列文章                             │
  │                                            │
  │ 你想写什么方向的系列？                       │
  │ ┌──────────────────────────────────────┐   │
  │ │ 写一个面向初学者的项目教程，从架构到部署  │   │
  │ └──────────────────────────────────────┘   │
  │                                            │
  │ 预设方向:                                  │
  │ [项目架构总览] [核心模块详解] [从零搭建]     │
  │ [最佳实践] [API 文档] [自定义]              │
  │                                            │
  │ [下一步]                                   │
  └────────────────────────────────────────────┘

Step 2: AI 生成系列规划
  ┌────────────────────────────────────────────┐
  │ 📚 系列规划审阅                            │
  │                                            │
  │ AI 根据项目上下文生成了以下 5 篇文章：       │
  │                                            │
  │  1. 🟢 项目架构与设计理念        ~800 字    │
  │     了解项目的整体架构和技术栈选择          │
  │  2. ⏳ 核心数据模型              ~1200 字   │
  │     深入核心数据结构和类型系统              │
  │  3. ⏳ 模块详解：编辑器核心       ~1500 字   │
  │     编辑器模块的设计与实现细节              │
  │  4. ⏳ AI 集成层                ~1000 字    │
  │     多提供商 AI 接入架构                   │
  │  5. ⏳ 构建与部署               ~800 字     │
  │     从开发到生产的完整流程                  │
  │                                            │
  │ [↑↓ 调整顺序] [+] 添加 [-] 删除             │
  │ [重新生成] [确认并进入写作]                 │
  └────────────────────────────────────────────┘

Step 3: 进入系列文章列表
  侧边栏合集下显示：
  ┌─ 我的项目（📁）                          │
  │  📚 系列: 项目教程（5 篇）                │
  │  ├── 🔵 项目架构与设计理念               │
  │  ├── ⚪ 核心数据模型                     │
  │  ├── ⚪ 模块详解：编辑器核心              │
  │  ├── ⚪ AI 集成层                       │
  │  └── ⚪ 构建与部署                       │
  │                                            │
  │ (普通文章列表)                             │
  │  ├── 📄 随手记                            │
  │  └── 📄 笔记                             │

Step 4: 点击某篇 → 生成大纲 → 生成全文
  (复用现有 StartupSplash 的规划→写作文稿流)
```

### 4.4 单篇写作的项目上下文注入

写单篇文章时，项目上下文以可视但低调的方式注入：

```
StartupSplash 输入框区域:
  ┌────────────────────────────────────────────┐
  │ 你想写什么？                                │
  │ ┌──────────────────────────────────────┐   │
  │ │ 分析一下项目的错误处理机制            │   │
  │ └──────────────────────────────────────┘   │
  │                                            │
  │ 📁 项目: my-project ｜ 已注入 128 个文件    │
  │            上下文作为 AI 写作背景           │
  │                                            │
  │ [✨ AI 规划] [快速开始]                     │
  └────────────────────────────────────────────┘
```

在 AI prompt 构建时，自动将 `ProjectContext` 拼入 system message：

```
你是一位资深中文写作者。
当前写作绑定项目「my-project」，项目信息如下：

## 项目概览
- 技术栈: TypeScript (45), Rust (23), JSON (12)
- 总文件: 128, 总行数: ~15,000

## 目录结构
src/
├── components/    (UI 组件层)
├── lib/           (核心业务逻辑)
├── App.tsx        (入口)
└── styles.css     (样式)

## 核心模块
- editor (60 个符号): 编辑器核心
- store  (35 个符号): 数据持久化
- ai     (27 个符号): AI 集成

## 关键导出符号
- EditorContent (component) — src/components/EditorContent.tsx
- agent.execute (function) — src/lib/agent.ts
- …
```

---

## 5. Rust 后端实现

### 5.1 新增 Tauri 命令

```rust
// 合集关联目录
#[tauri::command]
async fn link_collection_folder(collection_id: String, path: String) -> Result<ProjectContext, String>;

// 取消关联
#[tauri::command]
fn unlink_collection_folder(collection_id: String) -> Result<(), String>;

// 获取项目上下文（供 AI prompt 构建）
#[tauri::command]
async fn get_project_context(collection_id: String) -> Result<ProjectContext, String>;

// 重新扫描
#[tauri::command]
async fn rescan_project_folder(collection_id: String) -> Result<ProjectContext, String>;

// 保存系列规划
#[tauri::command]
async fn save_series_plan(collection_id: String, plan: SeriesPlan) -> Result<(), String>;

// 加载系列规划
#[tauri::command]
async fn load_series_plan(collection_id: String) -> Result<Option<SeriesPlan>, String>;
```

### 5.2 tree-sitter 符号提取（Level 2）

依赖 `Cargo.toml` 新增：

```toml
[dependencies]
tree-sitter = "0.24"
tree-sitter-typescript = "0.23"   # tsx + typescript
tree-sitter-rust = "0.22"
```

核心逻辑：

```rust
fn extract_symbols(source: &str, language: &str) -> Vec<SymbolInfo> {
    let mut parser = tree_sitter::Parser::new();
    parser.set_language(match language {
        "typescript" | "tsx" => tree_sitter_typescript::language_tsx(),
        "rust" => tree_sitter_rust::language(),
        // 按需扩展
        _ => return vec![],
    }).ok()?;

    let tree = parser.parse(source, None)?;
    let root = tree.root_node();

    // 遍历 AST 提取：
    // - function_declaration / function_item → function
    // - class_declaration → class
    // - interface_declaration → interface
    // - struct_item → struct
    // - type_alias → type_alias
    // 检查 export 关键字 → is_exported
    // 提取 doc_comment → docstring
}
```

### 5.3 CodeGraph SQLite 读取（Level 3）

```rust
fn read_codegraph_index(project_dir: &Path) -> Result<CodegraphData, String> {
    let db_path = project_dir.join(".codegraph/codegraph.db");
    if !db_path.exists() {
        return Err("没有 CodeGraph 索引".into());
    }

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    // 读取所有导出符号
    let mut stmt = conn.prepare(
        "SELECT name, kind, file_path, start_line, docstring, signature
         FROM nodes
         WHERE is_exported = 1 AND kind IN ('function', 'class', 'interface', 'struct', 'type_alias')
         ORDER BY file_path, start_line"
    ).map_err(|e| e.to_string())?;

    let symbols = stmt.query_map([], |row| {
        Ok(SymbolInfo {
            name: row.get(0)?,
            kind: row.get(1)?,
            file_path: row.get(2)?,
            line: row.get(3)?,
            docstring: row.get(4)?,
            signature: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    // ...
}
```

---

## 6. 前端实现

### 6.1 新增/修改文件清单

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `src/lib/collections.ts` | 修改 | SeriesPlan 类型 + 关联目录相关函数 |
| `src/lib/projectContext.ts` | **新建** | 前端 ProjectContext 类型 + IPC 桥接 |
| `src/components/CollectionFormModal.tsx` | 修改 | 增加关联目录 UI 区域 |
| `src/components/CollectionTree.tsx` | 修改 | + 菜单增加系列文章选项 + 右键菜单 |
| `src/components/SeriesPlanner.tsx` | **新建** | 系列规划对话组件 |
| `src/components/SeriesOverview.tsx` | **新建** | 系列概览列表组件 |
| `src/components/StartupSplash.tsx` | 修改 | 注入项目上下文提示 |
| `src/lib/plan.ts` | 修改 | 接入 ProjectContext 构建 prompt |
| `src-tauri/src/lib.rs` | 修改 | 注册新命令 |
| `src-tauri/src/project_indexer.rs` | **新建** | 扫描核心逻辑（std fs + tree-sitter + CodeGraph） |
| `src-tauri/Cargo.toml` | 修改 | 新增 tree-sitter 依赖 |

### 6.2 关键组件交互

```
CollectionTree
  │ 点击 [+] → 菜单
  │  ├─ 新建文章 → EditorPane (已有流程)
  │  └─ 规划系列文章 → SeriesPlanner
  │                       │
  │                       ▼
  │               SeriesPlanner (Step 1)
  │               用户输入系列方向
  │                       │
  │                       ▼
  │               SeriesPlanner (Step 2)
  │               AI 生成系列规划
  │               用户审阅调整
  │                       │
  │                       ▼
  │               保存 SeriesPlan → collections.ts
  │                       
  │               
  │       回到 CollectionTree
  │       系列文章列表展现在合集下
  │       点击某篇→
  │         if status == "planned":
  │           进入 StartupSplash (已有)
  │           自动注入项目上下文
  │           调用 plan.ts 生成大纲 (已有)
  │         if status == "writing" 或 "complete":
  │           直接打开文章 (已有)
```

---

## 7. 实施计划

### Phase 1: 基础扫描 + 关联目录 UI（核心）

```
预计工作量：3-5 天
交付物：
  ├─ Rust: project_indexer.rs (Level 1 std fs 扫描)
  ├─ Rust: 新增 Tauri 命令 (link_folder / get_project_context)
  ├─ Frontend: CollectionFormModal 目录选择 UI
  ├─ Frontend: CollectionTree 右键菜单补充
  ├─ Frontend: collections.ts 关联目录函数
  └─ 验证：选择目录后能显示项目结构
```

### Phase 2: 项目上下文注入 + 单篇增强

```
预计工作量：2-3 天
交付物：
  ├─ Rust: Level 2 tree-sitter 符号提取
  ├─ Rust: Level 3 CodeGraph SQLite 读取
  ├─ Frontend: plan.ts AI prompt 注入项目上下文
  ├─ Frontend: StartupSplash 项目标签
  └─ 验证：写单篇文章时 AI 能引用具体代码符号
```

### Phase 3: 系列规划

```
预计工作量：3-4 天
交付物：
  ├─ Frontend: SeriesPlanner 组件（三步对话）
  ├─ Frontend: SeriesOverview 组件（合集下展示）
  ├─ Frontend: collections.ts SeriesPlan 类型
  ├─ Rust: series_plan 存储命令
  └─ 验证：完整系列规划→生成→查看链路
```

---

## 8. 未实现 & 未来可能

- **增量扫描**: 当前是全量扫描，后续可用文件 hash 做增量
- **更多 tree-sitter 语言**: 目前仅 tsx/typescript/rust，可按需扩展 python/go/java
- **项目知识问答**: 基于 CodeGraph 索引的对话式代码问答（类似 Codex 的 codegraph_explore）
- **系列文章相互引用**: AI 生成时自动在前文后文之间加链接
- **导出系列为电子书**: 一键导出整个系列为 PDF/ePub
- **版本对比**: 项目代码更新后，对比旧索引定位变化，针对性更新文章

---

> 本文档对应「合集关联目录 → 项目系列文章」功能的完整设计方案。
> 实现过程中会更新文档以反映最终实现。


---
## 9.待实现功能
* tree-sitter 集成（Level 2）：在 project_indexer.rs 中加入 tree-sitter 解析，替代当前的正则符号提取
* CodeGraph SQLite 读取（Level 3）：读取 .codegraph/codegraph.db 获取 docstring/signature/edges
* 系列文章内链：生成时自动在前文后文间加引用链接
* 增量扫描：文件 hash 变化时只扫变动的文件