// skill/ — Skill 模块（v2.0.0 重构）
//
// 拆分说明：
//   types.rs       — 所有类型定义（Skill / UnifiedSkill / 枚举）
//   frontmatter.rs — 技能 Markdown 文件的 frontmatter 解析
//   store.rs       — SkillStore：文件系统发现、加载、安装
//   builtins.rs    — 内置技能定义（旧版 + 统一版）

pub mod builtins;
pub(crate) mod frontmatter;
pub(crate) mod store;
pub mod types;

// Re-export public types for backward compatibility
pub use types::*;
pub use store::SkillStore;
pub use builtins::{builtin_skills, unified_builtin_skills};
