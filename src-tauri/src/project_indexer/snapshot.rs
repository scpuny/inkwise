// project_indexer/snapshot.rs — 索引快照：跨会话增量变更检测
//
// 问题：文件监听只在 app 运行时生效，关闭后变更丢失。
// 方案：退出时保存快照，启动时对比检测变更。
//
// 检测策略（三层降级）:
//   1. git diff (最快，最准确)
//   2. mtime 对比 (次快，跨文件系统)
//   3. content hash 对比 (最慢，最准确)

use crate::project_indexer::scanner::{compute_file_hash, should_ignore};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use std::time::SystemTime;

/// 单个文件的快照条目
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotEntry {
    /// 相对项目根目录的路径
    pub rel_path: String,
    /// 文件修改时间 (epoch millis)
    pub mtime: u64,
    /// 内容 hash (SHA256)
    pub hash: String,
    /// 文件大小
    pub size: u64,
}

/// 项目索引快照（存 JSON 文件）
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IndexSnapshot {
    /// 快照对应项目根路径
    pub project_path: String,
    /// 创建时间
    pub created_at: u64,
    /// 文件列表
    pub files: Vec<SnapshotEntry>,
    /// 按 rel_path 索引的哈希映射，加速查找
    #[serde(skip)]
    pub file_map: HashMap<String, usize>,
}

/// 启动时检测到的变更集
#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct StartupDiff {
    /// 新增的文件
    pub added: Vec<String>,
    /// 修改的文件
    pub modified: Vec<String>,
    /// 删除的文件
    pub deleted: Vec<String>,
    /// 未变化的文件
    pub unchanged: Vec<String>,
}

impl StartupDiff {
    pub fn has_changes(&self) -> bool {
        !self.added.is_empty() || !self.modified.is_empty() || !self.deleted.is_empty()
    }

    pub fn all_changed(&self) -> Vec<String> {
        let mut all = Vec::with_capacity(self.added.len() + self.modified.len() + self.deleted.len());
        all.extend(self.added.clone());
        all.extend(self.modified.clone());
        all.extend(self.deleted.clone());
        all
    }
}

// ─── 核心类型实现 ───

impl IndexSnapshot {
    /// 构建索引 map 以便快速查找
    pub fn build_map(&mut self) {
        self.file_map = self
            .files
            .iter()
            .enumerate()
            .map(|(i, f)| (f.rel_path.clone(), i))
            .collect();
    }

    /// 查找快照中文件条目
    pub fn get_entry(&self, rel_path: &str) -> Option<&SnapshotEntry> {
        self.file_map
            .get(rel_path)
            .and_then(|&i| self.files.get(i))
    }
}

// ─── 文件系统扫描 ───

/// 扫描项目目录，生成当前文件状态快照
pub fn snapshot_dir_files(project_dir: &Path) -> Result<Vec<SnapshotEntry>, String> {
    let mut entries = Vec::new();

    walk_dir(project_dir, project_dir, "", &mut entries)?;

    Ok(entries)
}

fn walk_dir(
    base_dir: &Path,
    current_dir: &Path,
    rel_prefix: &str,
    entries: &mut Vec<SnapshotEntry>,
) -> Result<(), String> {
    let dir_reader = std::fs::read_dir(current_dir).map_err(|e| format!("读取目录失败: {}", e))?;

    for entry in dir_reader {
        let entry = entry.map_err(|e| format!("读取目录项失败: {}", e))?;
        let path = entry.path();
        let file_name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        // 计算相对路径
        let rel_path = if rel_prefix.is_empty() {
            file_name.clone()
        } else {
            format!("{}/{}", rel_prefix, file_name)
        };

        // 跳过忽略的文件/目录
        if should_ignore(&file_name) || file_name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            walk_dir(base_dir, &path, &rel_path, entries)?;
        } else if path.is_file() {
            // 只索引可读文本文件（跳过二进制）
            if is_text_file(&path) {
                let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
                let mtime = meta
                    .modified()
                    .ok()
                    .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as u64)
                    .unwrap_or(0);
                let size = meta.len();

                // 尝试计算 hash（大文件跳过）
                let hash = if size < 10 * 1024 * 1024 {
                    // < 10MB
                    match std::fs::read(&path) { Ok(bytes) => compute_file_hash(&bytes), Err(_) => String::new() }
                } else {
                    String::new()
                };

                entries.push(SnapshotEntry {
                    rel_path,
                    mtime,
                    hash,
                    size,
                });
            }
        }
    }

    Ok(())
}

/// 简单判断是否为文本文件（基于扩展名）
fn is_text_file(path: &Path) -> bool {
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        let ext_lower = ext.to_lowercase();
        crate::project_indexer::SUPPORTED_TEXT_EXTS.iter().any(|s| *s == ext_lower)
    } else {
        false
    }
}

// ─── Git 快速检测 ───

/// 尝试用 git diff-tree 检测变更（最快）
#[allow(dead_code)]
pub fn detect_git_changes(project_dir: &Path) -> Result<StartupDiff, String> {
    use std::process::Command;

    // 检查是否为 git 仓库
    let git_dir = project_dir.join(".git");
    if !git_dir.exists() {
        return Err("不是 git 仓库".into());
    }

    // git diff-tree: 对比 HEAD tree 与 working tree
    let output = Command::new("git")
        .args([
            "diff-tree",
            "--no-commit-id",
            "--name-status",
            "-r",
            "HEAD",
        ])
        .current_dir(project_dir)
        .output()
        .map_err(|e| format!("git 执行失败: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "git 错误: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut added = Vec::new();
    let mut modified = Vec::new();
    let mut deleted = Vec::new();
    let mut unchanged = Vec::new();

    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.splitn(2, '\t').collect();
        if parts.len() != 2 {
            continue;
        }
        let status = parts[0].trim();
        let path = parts[1].trim().to_string();

        match status {
            "A" | "C" | "R" => added.push(path),
            "M" => modified.push(path),
            "D" => deleted.push(path),
            _ => {}
        }
    }

    Ok(StartupDiff {
        added,
        modified,
        deleted,
        unchanged,
    })
}

// ─── 持久化 ───

/// 保存快照到 JSON 文件
/// 三层策略：增量跳过 → 原子写入 → copy fallback → 直接写入兜底
pub fn save_snapshot(snapshot: &IndexSnapshot, path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建快照目录失败: {}", e))?;
    }

    // 先序列化，后续多种写入方式复用此字符串
    let json = serde_json::to_string_pretty(snapshot).map_err(|e| format!("序列化快照失败: {}", e))?;

    // ─── 第一层：增量检查 ───
    // 若磁盘已有相同内容的快照，直接跳过写入
    if path.exists() {
        match std::fs::read_to_string(path) {
            Ok(existing) if existing == json => return Ok(()),
            _ => {}
        }
    }

    // ─── 第二层：原子写入（tmp + rename）───
    let tmp_path = path.with_extension("json.tmp");
    let write_result = std::fs::write(&tmp_path, &json)
        .and_then(|_| {
            // sync_all 确保数据落盘
            if let Ok(f) = std::fs::File::open(&tmp_path) {
                let _ = f.sync_all();
            }
            std::fs::rename(&tmp_path, path)
        });

    match write_result {
        Ok(_) => return Ok(()),
        Err(e) => {
            log::warn!("快照 rename 失败({})，尝试 copy fallback", e);
        }
    }

    // ─── 第三层：copy fallback ───
    if tmp_path.exists() {
        match std::fs::copy(&tmp_path, path) {
            Ok(_) => {
                let _ = std::fs::remove_file(&tmp_path);
                return Ok(());
            }
            Err(e) => {
                log::warn!("快照 copy 也失败({})，直接写入目标文件", e);
            }
        }
    }

    // ─── 第四层：直接写入目标文件（终极兜底）───
    std::fs::write(path, &json).map_err(|e| format!("写入快照失败: {}", e))
}

/// 从 JSON 文件加载快照
#[allow(dead_code)]
pub fn load_snapshot(path: &Path) -> Result<Option<IndexSnapshot>, String> {
    if !path.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(path).map_err(|e| format!("读取快照文件失败: {}", e))?;
    let mut snapshot: IndexSnapshot =
        serde_json::from_str(&content).map_err(|e| format!("解析快照失败: {}", e))?;

    snapshot.build_map();
    Ok(Some(snapshot))
}

// ─── 变更检测（三层降级） ───

/// 检测自上次快照以来的文件变更
///
/// 降级策略:
///   1. git diff-tree (最快)
///   2. mtime 对比 (中等)
///   3. content hash 对比 (最慢但最准)
#[allow(dead_code)]
pub fn detect_startup_changes(
    project_dir: &Path,
    snapshot: &IndexSnapshot,
    tier: u8,
) -> Result<StartupDiff, String> {
    // Tier 1: git diff
    if tier >= 1 {
        if let Ok(git_diff) = detect_git_changes(project_dir) {
            return Ok(git_diff);
        }
    }

    // Tier 2: mtime 对比
    if tier >= 2 {
        return detect_mtime_changes(project_dir, snapshot);
    }

    // Tier 3: hash 对比（最终降级）
    detect_hash_changes(project_dir, snapshot)
}

/// mtime 对比检测
fn detect_mtime_changes(project_dir: &Path, snapshot: &IndexSnapshot) -> Result<StartupDiff, String> {
    let current_files = snapshot_dir_files(project_dir)?;
    let current_map: HashMap<String, &SnapshotEntry> = current_files
        .iter()
        .map(|f| (f.rel_path.clone(), f))
        .collect();

    let mut added = Vec::new();
    let mut modified = Vec::new();
    let mut deleted = Vec::new();
    let mut unchanged = Vec::new();

    // 检查新增和修改
    for entry in &current_files {
        match snapshot.get_entry(&entry.rel_path) {
            Some(snap) => {
                if snap.mtime != entry.mtime || snap.size != entry.size {
                    modified.push(entry.rel_path.clone());
                } else {
                    unchanged.push(entry.rel_path.clone());
                }
            }
            None => {
                added.push(entry.rel_path.clone());
            }
        }
    }

    // 检查删除
    for snap_entry in &snapshot.files {
        if !current_map.contains_key(&snap_entry.rel_path) {
            deleted.push(snap_entry.rel_path.clone());
        }
    }

    Ok(StartupDiff {
        added,
        modified,
        deleted,
        unchanged,
    })
}

/// hash 对比检测（最精准）
fn detect_hash_changes(project_dir: &Path, snapshot: &IndexSnapshot) -> Result<StartupDiff, String> {
    let current_files = snapshot_dir_files(project_dir)?;
    let current_map: HashMap<String, &SnapshotEntry> = current_files
        .iter()
        .map(|f| (f.rel_path.clone(), f))
        .collect();

    let mut added = Vec::new();
    let mut modified = Vec::new();
    let mut deleted = Vec::new();
    let mut unchanged = Vec::new();

    // 检查新增和修改
    for entry in &current_files {
        match snapshot.get_entry(&entry.rel_path) {
            Some(snap) => {
                if snap.hash != entry.hash {
                    modified.push(entry.rel_path.clone());
                } else {
                    unchanged.push(entry.rel_path.clone());
                }
            }
            None => {
                added.push(entry.rel_path.clone());
            }
        }
    }

    // 检查删除
    for snap_entry in &snapshot.files {
        if !current_map.contains_key(&snap_entry.rel_path) {
            deleted.push(snap_entry.rel_path.clone());
        }
    }

    Ok(StartupDiff {
        added,
        modified,
        deleted,
        unchanged,
    })
}
