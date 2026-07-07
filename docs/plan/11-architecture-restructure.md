# 11 — 整体架构重塑原则与模块拆分

> 关联: 所有 plan/ 文档 | 原则: 合理架构、拆分模块、减少重复、提高可读性可扩展性

---

## 一、当前架构问题总览

```
src/
├── lib/
│   ├── ai/                      ← 技能 + agent + plan + chat 搅在一起
│   │   ├── agent.ts             ← 前端 AgentContext + 意图路由（应做两件事）
│   │   ├── agentEngine.ts       ← 前端 tool calling loop（和 Rust agent.rs 重复）
│   │   ├── writingSkill/        ← 技能系统（和 Rust skill.rs 平行脱节）
│   │   ├── plan.ts              ← 文章规划（和 agentEngine 耦合高）
│   │   ├── articleBlueprint.ts  ← 蓝图类型
│   │   ├── articleSessions.ts   ← session 记录
│   │   ├── articleReview.ts     ← 审阅
│   │   ├── ai.ts                ← AI API 调用
│   │   └── draw.ts              ← 图片生成
│   │
│   ├── storage/                 ← 存储（collection crud / articles / versions 分离但耦合）
│   │   ├── articles.ts          ← 内容 CRUD
│   │   ├── articleVersions.ts   ← 版本控制
│   │   ├── storageEngine.ts     ← 存储引擎
│   │   ├── providerModels.ts    ← 提供商管理
│   │   ├── skill.ts             ← Rust skill 映射
│   │   └── collections/         ← 合集模块（7 个文件）
│   │
│   ├── theme/                   ← 主题（分散在两个文件）
│   │   ├── theme.ts             ← UI 主题（6 种风格）
│   │   ├── articleThemes.ts     ← 文章排版主题（25 个主题）
│   │   ├── textSize.ts
│   │   └── fontFamily.ts
│   │
│   └── editor/                  ← 编辑器（样式 + diff + 编译）
│       ├── editorStyles.ts      ← 1585 行！编辑器配置+样式+主题导入导出全部在这
│       └── ...
│
├── store/                       ← Zustand store（有拆分但还有冗余）
│   ├── appStore.ts              ← 只是 re-export
│   ├── panelStore.ts
│   ├── editorStore.ts
│   ├── themeStore.ts
│   └── articleStore.ts
│
└── components/                  ← 组件
    └── ...
```

---

## 二、重塑原则

### 原则 1：一字一职责，一人一文件

每个文件只做一件事，且从文件名就能看出来：

```
✅ 好的结构：
  skill/
    ├── types.rs              ← 类型定义
    ├── builtins.rs           ← 内置技能
    ├── store.rs              ← 持久化
    ├── frontmatter.rs        ← frontmatter 解析
    └── mod.rs                ← 导出

❌ 当前结构：
  skill.rs                    ← 438 行：类型 + 前端解析 + 存储 + 内置技能全部混在一起
  lib/ai/writingSkill/        ← 平行定义，没有和 Rust 共享
```

### 原则 2：结构化定义优于字符串/对象字面量

```
✅ 枚举 + 类型：
  enum ToolCapability { ReadDocument, WriteDocument, ... }
  type HexColor = string

❌ 字符串：
  allowed_tools: Vec<String>           // 没有类型约束
  fontSize: string                      // "15" 还是 "15px"？不知道
```

### 原则 3：消除双边定义，单源头驱动

```
✅ 单源头：
  Rust skill.rs 定义 UnifiedSkill → IPC 传给前端
  Rust store.rs 路径为权威源 → 所有组件走统一 CRUD 层

❌ 双源头：
  Rust skill.rs 定义 Skill
  前端 writingSkill/ 定义 WritingSkill
  没有一方是权威
```

### 原则 4：目录结构 = 领域边界

```
当前：按文件类型分（lib/storage/、lib/ai/）
改为：按领域分（article/、project/、skill/、theme/、agent/）
```

---

## 三、目标模块结构

### 前端 `src/lib/`

```typescript
src/lib/
├── skill/                         ← 统一技能系统
│   ├── types.ts                   ← UnifiedSkill + 枚举（与 Rust 共享 schema）
│   ├── builtins.ts                ← 从 Rust IPC 获取（不再是手动定义）
│   ├── store.ts                   ← CRUD：load / save / delete
│   ├── context-planner.ts         ← 技能 ↔ 上下文规划
│   └── index.ts                   ← 导出
│
├── agent/                         ← Agent 执行
│   ├── types.ts                   ← AgentSession / ToolEvent / AgentContext
│   ├── engine.ts                  ← tool calling loop（现在在 agentEngine.ts）
│   ├── run.ts                     ← 执行入口（现在在 agent.ts 的路由部分）
│   ├── context.tsx                ← React Context Provider
│   └── hooks.ts                   ← useAgent / useChatStream
│
├── article/                       ← 文章
│   ├── types.ts                   ← Article / ArticleMeta
│   ├── content.ts                 ← 内容 CRUD（从 storage/articles.ts 移入）
│   ├── metadata.ts                ← 元信息 CRUD
│   ├── plan.ts                    ← 文章规划（现在在 ai/plan.ts）
│   ├── blueprint.ts               ← 蓝图类型（现在在 ai/articleBlueprint.ts）
│   ├── session.ts                 ← session 记录（现在在 ai/articleSessions.ts）
│   ├── review.ts                  ← 审阅（现在在 ai/articleReview.ts）
│   ├── version.ts                 ← 版本管理（现在在 storage/articleVersions.ts）
│   └── context.ts                 ← ArticleContext（现在在 lib/article/ArticleContext.ts）
│
├── collection/                    ← 合集（现在在 storage/collections/）
│   ├── types.ts
│   ├── crud.ts
│   ├── series.ts
│   ├── project-context.ts
│   ├── search.ts
│   └── index.ts
│
├── project/                       ← 项目上下文
│   ├── types.ts                   ← ProjectContext / FileNode / SymbolInfo
│   ├── scanner.ts                 ← 项目扫描调用
│   ├── watcher.ts                 ← 文件监听事件处理
│   └── index.ts
│
├── theme/                         ← 统一主题系统
│   ├── types.ts                   ← ArticleThemeVarsTyped + HexColor + PxValue
│   ├── renderer.ts                ← renderThemeVars() 拼 CSS
│   ├── presets.ts                 ← 精简后的 ~12 个核心主题 + 平台变体
│   ├── store.ts                   ← CRUD + recommendedThemeId
│   └── index.ts
│
├── ai/                            ← AI API 调用层（纯网络层，不含业务逻辑）
│   ├── api.ts                     ← chatCompletion / chatStream（现在在 ai.ts）
│   ├── providers.ts               ← 提供商管理（从 storage/providerModels.ts 移入）
│   ├── image.ts                   ← 图片生成（现在在 ai/draw.ts）
│   └── index.ts
│
├── editor/                        ← 编辑器（按职责拆分）
│   ├── config.ts                  ← 样式/字号/行距等配置
│   ├── html.ts                    ← 编译/导出（compileHtml）
│   ├── diff.ts                    ← diff 逻辑
│   └── index.ts
│
├── bridge/
│   └── tauri.ts                   ← 不变，仍是 IPC 桥接层
│
├── events/
│   └── eventBus.ts                ← 不变
│
└── utils/
    ├── text.ts                    ← 不变
    └── types.ts
```

### Rust 后端 `src-tauri/src/`

```rust
src-tauri/src/
├── main.rs                        ← 不变
│
├── lib.rs                         ← 精简：只保留命令注册 + 启动逻辑
│                                    不包含具体业务实现代码
│
├── store/                         ← JSON 持久化（从 store.rs 抽离）
│   ├── mod.rs                     ← DataStore 结构体 + 统一 CRUD
│   ├── collections.rs
│   ├── articles.rs
│   ├── providers.rs
│   ├── settings.rs
│   ├── series.rs
│   └── platforms.rs
│
├── db.rs                          ← SQLite 层（不变，只做 FTS）
│
├── ai.rs                          ← AI 网络层（不变）
│
├── skill/                         ← 统一技能系统（从 skill.rs 抽离）
│   ├── mod.rs                     ← UnifiedSkill 类型 + 导出
│   ├── builtins.rs                ← 所有内置技能
│   ├── frontmatter.rs             ← frontmatter 解析
│   └── store.rs                   ← 持久化
│
├── agent/                         ← Agent 执行（从 agent.rs 抽离）
│   ├── mod.rs                     ← 入口 + ContextPlan 类型
│   ├── engine.rs                  ← tool calling loop
│   └── prompt.rs                  ← prompt 构建
│
├── project_indexer/               ← 项目扫描（从 project_indexer.rs 抽离）
│   ├── mod.rs                     ← 导出
│   ├── scanner.rs                 ← scan_project + 增量
│   ├── snapshot.rs                ← IndexSnapshot + 启动检测
│   ├── watcher.rs                 ← spawn_folder_watcher
│   ├── queries/                   ← .scm 查询文件
│   │   ├── code-snippet/
│   │   │   ├── typescript.scm
│   │   │   └── rust.scm
│   │   ├── import/
│   │   │   ├── typescript.scm
│   │   │   └── rust.scm
│   │   └── root-context/
│   │       ├── function_declaration/
│   │       │   └── typescript.scm
│   │       └── method_definition/
│   │           └── typescript.scm
│   └── codegraph.rs               ← CodeGraph 读取
│
├── vector/                        ← 向量引擎（新）
│   ├── mod.rs                     ← 入口
│   ├── embedder.rs                ← embedding 计算
│   ├── chunk.rs                   ← 分块策略
│   ├── search.rs                  ← 余弦相似度检索
│   └── indexer.rs                 ← 增量索引逻辑
│
├── publisher/
│   ├── mod.rs
│   └── wechat.rs                  ← 不变
│
└── image_gen.rs                   ← 不变
```

---

## 四、代码重复消除矩阵

| 重复代码 | 位置 | 解决方法 |
|---------|------|---------|
| Rust + 前端双套技能定义 | `skill.rs` + `writingSkill/` | 统一为 UnifiedSkill，前端从 IPC 获取 |
| Rust + 前端双套 agent 执行 | `agent.rs` + `agentEngine.ts` | Rust 端做主执行，前端只做展示调度 |
| 合集类型定义 | `store.rs` + `types.ts` | Rust JSON 为权威，前端反序列化 |
| 项目上下文类型 | `project_indexer.rs` + `types.ts` | 通过 serde 反序列化，前端不重复定义 |
| 主题颜色字面量重复 | `articleThemes.ts` 每个主题都写 | `BASE_VARS` + `platformOverrides` 继承 |
| `editorStyles.ts` 1585 行 | 编辑器配置 + 样式 + 导入导出 | 按职责拆分 3 个文件 |

---

## 五、注释规范

```typescript
// 文件头：一句话说明职责
// skill/store.ts — UnifiedSkill 持久化（Tauri IPC + localStorage 降级）

// 模块分组线：解释一组相关函数
/* ─── 内置技能加载 ─── */

// 复杂函数：说明输入输出和副作用
/**
 * 检测启动时的项目变更。
 * 
 * 1. 尝试 git diff（精度最高）
 * 2. 降级到 mtime + size stat 遍历
 * 3. 再降级到 sha256 hash 对比
 * 
 * 返回变更/新增/删除的文件列表。
 */
```

---

## 六、实施路线

```
第 1 阶段（技能统一）
  ├── skill.rs → skill/ 模块拆分 + UnifiedSkill
  ├── writingSkill/ → 统一到 UnifiedSkill，前端从 IPC 获取
  └── agent.rs → agent/ 模块拆分

第 2 阶段（主题精简）
  ├── articleThemes.ts → 类型完善 + 精简主题（25→12）
  └── 添加技能↔主题联动

第 3 阶段（模块重组）
  ├── ai/ 扁平化 → 按领域拆分 （skill/agent/article/project）
  ├── storage/collections → collection/
  ├── storage/articles → article/
  └── editorStyles.ts 拆分

第 4 阶段（向量 + 增量）
  ├── vector/ 新模块
  ├── project_indexer/ 拆分 + IndexSnapshot
  └── context-planner 集成
```
