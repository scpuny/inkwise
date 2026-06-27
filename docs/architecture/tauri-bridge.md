# Tauri IPC 桥接

> 版本: v1.0 | 关联: storage/storage-architecture.md, overview.md

---

## 1. 设计目标

应用可在浏览器 (`npm run dev`) 和 Tauri (`npm run tauri:dev`) 两种环境下运行，前端代码通过桥接层透明适应两种环境。

## 2. 核心模块

### 2.1 环境检测 (`src/lib/bridge/tauri.ts`)

```typescript
// 检测 Tauri：__TAURI_INTERNALS__ 由 Tauri 的 WebView 注入
const isTauri: boolean =
  typeof window !== "undefined" &&
  typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
```

### 2.2 三阶调用模式

```typescript
// 1. 简单调用（Tauri 不可用时抛异常）
export async function tryInvoke<T>(
  cmd: string, args?: Record<string, unknown>
): Promise<T>

// 2. 带回退的调用（推荐）
export async function invokeOrFallback<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  fallback: () => T | Promise<T>,
): Promise<T>

// 3. 调用后忽略结果
await invokeOrFallback(TauriCommands.SaveArticleMeta, { meta }, () => {});
```

## 3. 命令枚举

所有 Tauri 后端命令在 `TauriCommands` 枚举中集中管理，防止拼写错误：

| 类别 | 命令数 | 示例 |
|------|--------|------|
| 合集/文章 | 20+ | get_collections, save_article, load_article_meta |
| 提供商 | 5 | get_providers, fetch_models |
| 技能 | 8 | list_skills, run_skill |
| 发布 | 7 | get_platform_configs, publish_to_platform |
| AI | 1 | chat_stream |
| 工具 | 8+ | pick_folder, dialog_open |

## 4. 双模式差异

| 功能 | Tauri 模式 | 浏览器模式 |
|------|-----------|-----------|
| 数据持久化 | SQLite + JSON 文件 | localStorage |
| AI 调用 | Rust ai.rs → HTTP API | ❌ 不可用（提示安装 Tauri） |
| 发布到平台 | Rust publisher.rs → HTTP | ❌ 不可用 |
| 文件对话框 | tauri-plugin-dialog | ❌ 不可用 |
| 剪贴板 | tauri-plugin-clipboard-manager | navigator.clipboard |
| 全局快捷键 | tauri-plugin-global-shortcut | ❌ 不可用 |
| 启动屏 | Tauri 原生启动屏 | 无 |

## 5. Rust 端注册

Tauri 命令在 `src-tauri/src/lib.rs` 中注册：

```rust
#[tauri::command]
fn save_article(id: String, content: String) -> Result<(), String> {
    // ...
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_article,
            load_article,
            // ...
        ])
        .run(tauri::generate_context!())
}
```

---

> 关联文档: [存储架构](../storage/storage-architecture.md) | [架构总览](overview.md)
