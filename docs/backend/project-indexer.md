# 项目索引器

> 版本: v1.4 | 位置: `src-tauri/src/project_indexer.rs`

---

## 概述

项目索引器是 InkWise 的代码扫描引擎，负责为「项目系列写作」功能提取项目上下文。v1.4 使用 tree-sitter 进行 AST 级别的符号提取，替代了早期基于正则的实现，并通过文件监听实现增量更新。

## 核心功能

### 1. 项目结构扫描

- 递归遍历项目目录，构建 `FileNode` 树
- 统计各语言文件数、代码行数
- 识别配置文件（package.json, Cargo.toml, tsconfig 等）

### 2. AST 符号提取（tree-sitter）

`extract_imports_treesitter()` 函数使用 tree-sitter 解析源码：

- 支持语言：TypeScript (.ts/.tsx)、JavaScript (.js/.jsx)、Rust (.rs)
- 提取 imports（导入语句）
- 提取 exports（导出声明）
- 提取函数/类定义（可作为代码导航锚点）
- 构建 `ImportEdge`（导入关系图）

### 3. 增量扫描

`spawn_folder_watcher()` 函数使用 notify + notify-debouncer-mini：

```
启动文件监听 → debounce 300ms 防抖
  → 检测变更文件 → 仅重新索引变更部分
  → 合并到已有 ProjectContext → 推送到前端
```

对比全量重新扫描，增量扫描在大项目中有显著性能优势。

### 4. 前端集成

| Tauri 命令 | 说明 |
|-----------|------|
| `scan_project` | 全量扫描项目目录 |
| `get_project_info` | 获取项目基本信息 |
| `start_watching_project` | 启动文件监听（增量扫描） |
| `stop_watching_project` | 停止文件监听 |
| `update_project_context` | 手动刷新项目上下文 |

## 输出数据结构

```rust
ProjectContext {
    name: String,
    root_path: String,
    primary_language: Option<String>,
    structure: Vec<FileNode>,       // 文件树
    summary: ProjectSummary,         // 统计摘要
    configs: Vec<ConfigFile>,       // 配置信息
    symbols: Vec<SymbolInfo>,       // AST 符号
    imports: Vec<ImportEdge>,       // 导入关系
    codegraph_available: bool,      // CodeGraph 是否可用
}
```
