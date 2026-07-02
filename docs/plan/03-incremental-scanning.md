# 03 — 三层降级增量扫描

> 关联: 01-data-consistency.md, 04-query-ast.md, 05-vector-embedding.md

---

## 现状

```
目前的增量能力：
  ├── 运行时: spawn_folder_watcher          ← 已实现但前端没接
  │     └── 监听 .ts/.tsx/.js/.jsx/.rs     ← 缺 .md / .py / .go 等
  ├── AST 层: FileHashCache hash 对比       ← 已实现，但只存 hash 无 mtime
  └── 启动时: 无检测                        ← 缺失！
```

**核心问题**：关 app 后 git pull / 手动改文件 → 重启 app 完全不知道变了什么。

---

## 设计：三层降级 + IndexSnapshot

### 检测策略（按优先级）

```
第一层（首选，最快）   git diff --name-only <last_commit>..HEAD
                      │ 不是 git 仓库 → 降级
                      ▼
第二层（通用，极轻量）   stat: mtime + size 对比
                      │ stat 不可用 → 降级
                      ▼
第三层（通用，IO 重）   sha256 全量 hash（现有 FileHashCache）
```

### IndexSnapshot 数据结构

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
struct IndexSnapshot {
    version: u32,
    last_indexed_at: u64,           // 时间戳
    last_commit: Option<String>,    // git HEAD (git 项目时)
    project_path: String,
    file_count: u32,
    files: HashMap<String, FileMeta>,
    chunk_count: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct FileMeta {
    mtime: u64,            // 文件修改时间
    size: u64,             // 文件大小（字节）
    hash: String,          // sha256（确认变更时填充）
    indexed: bool,         // 是否已被 AST/向量索引
}
```

### 启动检测算法

```rust
fn detect_startup_changes(
    snapshot: &IndexSnapshot,
    project_dir: &Path,
) -> StartupDiff {
    let mut changed = Vec::new();
    let mut removed = Vec::new();
    let mut added = Vec::new();
    let mut seen = HashSet::new();

    // 1. 尝试 git diff（精度最高且零内容读取）
    if snapshot.last_commit.is_some() {
        if let Ok(changed_files) = git_diff_since(&snapshot.last_commit, project_dir) {
            // git 返回的是精确变更列表，直接返回
            // 不需要 stat 遍历
            return StartupDiff { changed: changed_files, removed: vec![], added: vec![] };
        }
        // git diff 失败，降级到 stat
    }

    // 2. stat 遍历（非 git / git 失败）
    for entry in walkdir(project_dir) {
        let path = entry.path();
        let rel = path.strip_prefix(project_dir)?;
        seen.insert(rel.to_string());
        
        let stat = fs::metadata(path)?;
        let mtime = stat.modified()?;
        let size = stat.len();
        
        match snapshot.files.get(rel) {
            None => {
                added.push(rel.to_string());  // 新文件
            }
            Some(cached) if cached.mtime != mtime || cached.size != size => {
                // mtime/size 变了 → 读 hash 确认
                let content = fs::read(path)?;
                let hash = sha256(&content);
                if hash != cached.hash {
                    changed.push(rel.to_string());
                }
            }
            _ => {} // 没变，跳过
        }
    }

    // 3. 快照有但磁盘上已删除
    for path in snapshot.files.keys() {
        if !seen.contains(path) {
            removed.push(path.clone());
        }
    }

    StartupDiff { changed, removed, added }
}
```

### 运行时 + 启动时配合

```
关闭 app → 保存 IndexSnapshot 到 ~/.inkwise/data/index_snapshots/{project_hash}.json
            保存 last_commit = git rev-parse HEAD

启动 app →
  1. 读 IndexSnapshot
  2. git diff (或 mtime stat) → 检测离线变更
  3. 增量 AST + 增量向量
  4. 更新 IndexSnapshot
  5. 启动 file watcher（运行时实时监控）

运行中 →
  file watcher 检测到文件变更 → 即时增量 AST + 增量向量 → 更新 IndexSnapshot
```

### 性能表现

| 场景 | 一万个文件的检测时间 | 是否读文件内容 |
|------|---------------------|--------------|
| git diff（有 git） | ~5ms | 否 |
| stat 遍历（无 git） | ~10ms | 否（仅 mtime/size） |
| hash 降级（stat 包装证） | 仅变更的 1-5 个文件 | 是 |

### 文件 watcher 补齐

当前 `spawn_folder_watcher` 只监听 `ts/tsx/js/jsx/rs`，需要扩展：

```rust
// 当前
if !matches!(ext, "ts" | "tsx" | "js" | "jsx" | "rs") {
    continue;
}

// 改为：配置化语言列表
const WATCHED_EXTS: &[&str] = &[
    "ts", "tsx", "js", "jsx", "rs", "py", "go", "java",
    "rb", "php", "c", "cpp", "h", "hpp",
    "md", "mdx", "json", "yaml", "toml",
];

if !WATCHED_EXTS.contains(&ext) {
    continue;
}
```

### IndexSnapshot 文件格式

```json
{
  "version": 1,
  "lastIndexedAt": 1700000000,
  "lastCommit": "def456abc789",
  "projectPath": "/Users/me/project",
  "fileCount": 342,
  "chunkCount": 460,
  "files": {
    "src/main.rs": { "mtime": 1700000100, "size": 20480, "hash": "sha256:abc...", "indexed": true },
    "src/lib.rs":  { "mtime": 1700000000, "size": 10240, "hash": "sha256:def...", "indexed": true }
  }
}
```

---

## 实现步骤

| 步骤 | 内容 | 文件 |
|------|------|------|
| 1 | 定义 `IndexSnapshot` 和 `StartupDiff` 类型 | `project_indexer.rs` |
| 2 | 实现 `save_snapshot()` / `load_snapshot()` | `project_indexer.rs` |
| 3 | 实现 `detect_startup_changes()` 三层降级 | `project_indexer.rs` |
| 4 | 改造 `scan_project()` 支持增量模式（`changed_files` 参数） | `project_indexer.rs` |
| 5 | 前端接收 `project-files-changed` 事件 | `hooks/appHooks.ts` |
| 6 | 扩展 watcher 支持的语言列表 | `project_indexer.rs` |
| 7 | 关 app / 切项目时保存 IndexSnapshot | `lib.rs` |
