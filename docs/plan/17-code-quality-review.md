# 17 — 全功能代码质量审查

> 关联: 12-feature-map.md, 13-skill-business-redesign.md, 11-architecture-restructure.md

---

## 一、审查范围

基于 12-feature-map.md 中列出的 11 个业务域，逐一审查代码质量、缺陷和可优化点。

---

## 二、逐域审查结果

### 【域 1：文章生命周期】

#### 1.1 创建文章

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| CRUD 流程 | `addArticle` → `saveCollections` 双写 JSON + localStorage | 🔴 非原子 |
| blueprint 创建 | `createDefaultBlueprint` 在 crud.ts 中硬编码 | 🟡 应移到独立 factory |
| 编辑器加载 | 通过 `loadArticle` 从 Rust JSON 读内容 | ✅ 正确 |
| 新建流程 | 弹窗选合集，增加步骤 | 🔴 UX 问题（doc 14 已覆盖） |

#### 1.2 编辑文章

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| autoSave 防抖 | `useArticleLifecycle` 3s 防抖 | ✅ 正确 |
| 保存失败处理 | 无用户可见的错误提示 | 🟡 应加 toast 提示 |
| 样式持久化 | localStorage `article-style-config:{id}` | ✅ 可接受（前端缓存） |
| 版本快照 | 每次保存前自动拍，localStorage 存储 | 🟡 版本应存 Rust JSON |

#### 1.3 删除/回收站

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| trashArticle | 物理删除 content/meta，不删 SQLite | 🔴 doc 02 已修复 |
| permanentlyDelete | 只清回收站列表 | 🔴 doc 02 已修复 |
| restoreArticle | 内容已物理删除，无法真正恢复 | 🔴 回收站策略要改 |
| 回收站真意 | 应只移出合集列表，不物理删除 | 🔴 需改为软删除 |

**🔴 新增发现：回收站策略定义有问题**

当前 `trashArticle` 物理删除了 `{id}.md` 和 `{id}.meta.json`，但标题还在回收站列表。
如果用户恢复，只有标题回来了，内容丢了。正确的回收站应该是：

```
trashArticle → 从合集移除 → 加到 trash 列表（不删 content/meta）
permanentlyDelete → 真正物理删除
restoreArticle → 从 trash 移回合集列表（content/meta 还在）
```

#### 1.4 蓝图 Blueprint

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| skillId 可选 | `skillId?: string` | 🔴 doc 13 改为 styleId 必填 |
| outline 结构 | OutlineSection[]，含 id/title/level/description/status | ✅ 结构合理 |
| 持久化 | JSON 文件 + localStorage | 🟡 去重 localStorage |
| phase 切换 | planning→writing→reviewing→complete | ✅ 流程正确 |

### 【域 2：合集管理】

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| 合集 CRUD | 7 个文件在 `collections/`，有冗余 | 🟡 doc 11 合并精简 |
| 合集树渲染 | CollectionTree 直接从 browserLoad 读 | 🔴 doc 01 改为 loadCollections |
| 导入导出 | JSON 导出/导入 | ✅ 基础功能完整性好 |

### 【域 3：系列规划】

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| 删除级联 | deleteSeriesPlan 不清理关联 | 🔴 doc 02 |
| series_chunks | 向量层预留，尚未实现 | 🟡 doc 05 覆盖 |
| 系列 ↔ 文章关联 | 脆弱的 articleId 引用，无双向约束 | 🟡 应加引用计数 |

### 【域 4：AI 写作引擎】

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| 多提供商路由 | ai.rs 支持 OpenAI/Anthropic/DeepSeek | ✅ 架构好 |
| 流式输出 | 前端 sendChatStream + Rust 端 streaming | ✅ 正确 |
| 双套 agent | 前端 agentEngine.ts + Rust agent.rs | 🔴 doc 09 统一 |
| tool calling | 前端有完整 tool loop，Rust 无 | 🔴 doc 09 Rust 端加 |
| 上下文注入 | 全量倒给 AI，无裁剪 | 🔴 doc 06 Context Planner |

### 【域 5：Skill 技能系统】

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| 双套技能 | Rust 14 个 + 前端 10 个，完全脱节 | 🔴 doc 09 统一 |
| 风格/动作混淆 | skill 同时承担风格和动作两个语义 | 🔴 doc 13 拆分 |
| frontmatter 解析 | skill.rs 438 行混合类型+逻辑 | 🟡 doc 11 分包 |
| 自定义技能 | localStorage 存 inkwise-custom-skills | 🟡 应存 Rust JSON |
| 快捷键 | Alt+1~5 支持 | ✅ 用户体验好 |
| runAs 模式 | Inline / Subagent 两种 | ✅ 灵活 |

### 【域 6：审阅 Review】

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| 审阅维度 | 5 维度硬编码（开头/结构/内容/表达/格式） | 🔴 doc 13 改为风格感知 |
| 评分方式 | 优/良/差 三级 | ✅ 简洁够用 |
| 修复方式 | `applyOptimization` 全量重写 | 🔴 doc 13 改为逐段修复 |
| 审阅触发 | 需要手动切到评估 tab | 🟡 doc 14 自动切换 |
| 审阅关联 skill | 不感知当前写作风格 | 🔴 doc 13 修复 |

### 【域 7：图片生成与插图】

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| AI 绘图 | OpenAI DALL·E 3 / ComfyUI | ✅ 基础能力完整 |
| 自动配图 | `draw.ts` 提取关键词 → 生成 → 插入文章 | ✅ 流程合理 |
| 配图触发 | 编辑器内 / Agent 建议 | 🟡 应有独立"配图"按钮 |
| 多模型支持 | 只 DALL·E 3，不兼容 Stable Diffusion 等 | 🟡 可扩展 provider |

### 【域 8：搜索】

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| 前端搜索 | `search.ts` 内存遍历全文 | 🔴 性能差，应接 SQLite FTS |
| SQLite FTS | `search_articles_db` 已实现但不被前端调用 | 🔴 doc 01 补前端接入 |
| 向量搜索 | 尚未实现 | 🟡 doc 05 覆盖 |

### 【域 9：代码扫描】

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| AST 解析 | 200 行手写遍历 | 🔴 doc 04 Query 化 |
| 导入解析 | 同上手写 | 🔴 doc 04 Query 化 |
| 增量扫描 | FileHashCache 只存 hash 不存 mtime | 🔴 doc 03 |
| 启动检测 | 无 | 🔴 doc 03 |
| watcher | 已实现但不接前端，类型少 | 🔴 doc 03 |
| CodeGraph | 三段式降级，设计合理 | ✅ |
| 配置读取 | 支持 package.json/Cargo.toml/pyproject.toml 等 | ✅ |

### 【域 10：设置与快捷键】

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| 设置面板 | 11 个 section，功能完整 | ✅ 结构清晰 |
| 快捷键 | Alt+1~5 / Cmd+K / Cmd+Enter / 全局快捷键 | ✅ 完善 |
| 数据导出 | JSON 导入/导出合集 | ✅ |
| 设置持久化 | localStorage + Rust JSON | 🟡 需统一 |

### 【域 11：状态管理】

| 检查项 | 当前状态 | 问题 |
|--------|---------|------|
| Zustand stores | 4 个 store，有 panelStore 等 | ✅ 拆分合理 |
| panelStore | 10+ 布尔值分散管理 | 🟡 可细分 |
| React Context | AgentContext / ArticleContext | ✅ 结构合理 |

---

## 三、缺陷严重度分布（新增）

```
🔴 P0 必须修复
├── 回收站逻辑错误（trashArticle 物理删内容）
├── 风格/动作混淆
├── 数据多源头不同步
├── 删除级联遗漏
├── 前端 search.ts 不调 SQLite FTS
├── 审阅维度硬编码
└── 离线变更无检测

🟡 P1 应修复
├── 版本快照只存 localStorage
├── 蓝图编辑器弹窗增加步骤
├── 配图功能缺乏独立入口
├── DALL·E 独占，不支持其他绘图模型
├── 自定义技能只存 localStorage
├── 保存失败无用户提示
└── editorStyles.ts 1585 行大文件

🟢 P2 锦上添花
├── 大纲滚动联动优化
├── 面板布局左/中/右可拖拽
├── 焦点模式退出按钮优化
├── 工具栏快捷键提示
└── 状态栏精简
```

---

## 四、关键指标

| 指标 | v1.x | v2.0.0 目标 |
|------|------|------|
| 数据存储源数量 | 3（JSON + localStorage + SQLite） | 1（JSON 权威） |
| 技能系统数量 | 2（Rust + 前端） | 1（UnifiedSkill） |
| 文章主题数 | 25 | 12（核心）+ 平台变体 |
| editorStyles.ts 行数 | 1585 | ≤500 |
| agent 执行引擎数 | 2（前端 + Rust） | 1（Rust 主，前端调度） |
| 审阅维度 | 5 硬编码 | 动态风格感知 |
| 启动检测 | 无 | 三层降级扫描 |
| 向量检索 | 无 | bge-small-zh-v1.5 |
| AST 解析效率 | 手写遍历 | tree-sitter Query |

---

## 五、插图/质量评审/一键修复专项

### 插图（Illustration）

**当前实现**：
- `draw.ts` 通过 LLM 从文章中提取配图关键词
- 调用 DALL·E 3 生成图片
- 插入到文章对应章节

**问题**：
1. 没有独立的"配图"按钮，只能通过 AI 面板建议触发
2. 不支持 Stable Diffusion / Midjourney 等本地模型
3. 生成后插入位置判断靠 LLM，位置可能不准确
4. 生成图片不缓存，重复生成浪费 token

**改进建议**：
1. 编辑器 Toolbar 增加 🖼️ 配图按钮
2. 缓存已生成的图片（hash 文章内容 → 缓存 key）
3. 支持更多绘图 Provider（ComfyUI / Stable Diffusion）

### 质量评审（Quality Review）

**当前实现**：
- `articleReview.ts` 5 维度审阅
- `ReviewPanel.tsx` 展示评分
- `applyOptimization` 全量重写修复

**问题**：
1. 维度不感知写作风格（doc 13 已覆盖）
2. 修复方式粗暴（全量重写，用户无拒绝）
3. 审阅后侧栏不自动切换评估 tab（doc 14 已覆盖）
4. 重复审阅浪费 token（无缓存机制）

**改进建议**：
1. 审阅结果缓存（文章未修改则不重复审阅）
2. 逐段修复交互：用户可以接受/拒绝每项修改
3. 审阅后自动弹出浮动层展示结果

### 一键修复（One-Click Fix）

**当前实现**：
- `applyOptimization` 函数一次全量重写
- 无阶段性确认
- 无对比视图

**问题**：
1. 全量重写可能改变文章整体风格
2. 用户不可控（不可选择修哪些维度）
3. 无前后对比

**改进建议**：
1. 改为逐维度修复，用户可以勾选要修复的维度
2. 每个维度修复后生成 diff 对比
3. 提供"全部接受"和"逐项确认"两种模式
4. 保留修复前版本（自动拍快照）

---

## 六、安全与边界

| 检查项 | 状态 | 说明 |
|--------|------|------|
| API Key 存储 | ✅ 加密存储 | Rust JSON |
| 用户数据隔离 | ✅ 本地存储 | 无多用户场景 |
| 文件操作边界 | ✅ 路径校验 | Rust `project_indexer.rs` 有限制 |
| Tauri 命令暴露 | ✅ `generate_handler![]` 显式注册 | 未暴露多余命令 |
| 前端资源内联 | ✅ CSS 变量 + BEM | 无 XSS 风险（用户内容可控） |
| 第三方依赖 | 🟡 需关注供应链 | node_modules 较大 |
| 导出数据脱敏 | 🟡 API Key 导出时含在 JSON 中 | 导出时建议剔除 |
