# 存储架构

> 版本: v1.0 | 关联: architecture/overview.md

---

## 1. 设计原则

- **Tauri 后端权威**：桌面模式下所有数据持久化由 Rust 后端负责，前端只读写缓存
- **localStorage 回退**：浏览器模式下使用 localStorage 兜底，保证 `npm run dev` 可用
- **增量迁移**：schema 版本管理，自动执行增量迁移
- **分层隔离**：存储层不感知业务逻辑，业务通过 `invokeOrFallback` 透明切换后端

## 2. 存储层次

```
┌──────────────────────────────────────────────┐
│                前端应用层                      │
│  invokeOrFallback → isTauriEnv ? Rust : LS   │
├──────────────────────────────────────────────┤
│               StorageEngine                   │
│  前端缓存 + 统一读写接口                       │
├──────────────────────────────────────────────┤
│     Tauri invoke         localStorage        │
│        ↓                       ↓             │
│  ┌──────────┐         ┌──────────────┐       │
│  │ Rust 后端 │         │ localStorage │       │
│  │ SQLite    │         │ (浏览器回退)  │       │
│  │ JSON 文件 │         └──────────────┘       │
│  └──────────┘                                 │
└──────────────────────────────────────────────┘
```

## 3. 双模式机制

### 3.1 Tauri 模式

```typescript
// src/lib/bridge/tauri.ts
export async function tryInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (_invoke) {
    return (await _invoke(cmd, args)) as T;
  }
  throw new Error(`Tauri invoke not available for: ${cmd}`);
}
```

- 检测 `window.__TAURI_INTERNALS__` 判断 Tauri 环境
- 动态 import `@tauri-apps/api/core` 获取 invoke 函数
- 所有命令集中管理在 `TauriCommands` 枚举中

### 3.2 浏览器模式

```typescript
// invokeOrFallback — Tauri 不可用时自动回退
export async function invokeOrFallback<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  fallback: () => T | Promise<T>,
): Promise<T> {
  if (isTauriEnv()) {
    return await tryInvoke<T>(cmd, args);
  }
  return await fallback();
}
```

## 4. Rust 持久化层

### 4.1 SQLite（db.rs）

| 表 | 用途 |
|----|------|
| `collections` | 合集元数据 |
| `articles` | 文章内容 + 元数据（FTS5 全文索引） |
| `series_plans` | 系列规划 |
| `providers` | AI 提供商配置 |
| `platform_configs` | 发布平台凭据 |
| `publish_records` | 发布历史 |
| `writing_skills` | 自定义写作技能 |

FTS5 全文检索：
```sql
CREATE VIRTUAL TABLE articles_fts USING fts5(
  title, content, content=articles, content_rowid=rowid
);
```

### 4.2 JSON 文件（store.rs）

- `collections.json` — 合集与文章结构
- `providers.json` — AI 提供商配置
- `platforms.json` — 发布平台配置
- `publish_records.json` — 发布历史
- `articles/{id}.md` — 独立 Markdown 文件
- `articles/{id}.meta.json` — 文章元数据
- `articles/{id}.styles.json` — 文章级样式配置

## 5. ArticleContext 持久化

每篇文章持有一个 `ArticleContext` 实例，构造时自动从 `articles/{id}.styles.json` 加载样式配置并 apply 到 document：

```typescript
class ArticleContext {
  private styleConfig: StyleConfig;
  
  constructor(articleId: string) {
    this.styleConfig = loadStyleConfig(articleId);
    this.applyStyles();
  }
  
  updateStyle(updates: Partial<StyleConfig>) {
    this.styleConfig = { ...this.styleConfig, ...updates };
    this.applyStyles();
    this.persist();
  }
  
  private persist() {
    saveStyleConfig(this.articleId, this.styleConfig);
  }
}
```

切换文章时旧 context 自动 GC 回收，无内存泄漏。

## 6. 前端 StorageEngine

```typescript
class StorageEngine {
  private cache: Map<string, unknown>;
  
  async get<T>(key: string): Promise<T | null>;
  async set<T>(key: string, value: T): Promise<void>;
  async delete(key: string): Promise<void>;
}
```

统一读写接口，前端缓存在 `Map` 中，写操作同步到后端（Tauri 或 localStorage）。

---

> 关联文档: [架构总览](../architecture/overview.md) | [Tauri 桥接](../architecture/tauri-bridge.md)
