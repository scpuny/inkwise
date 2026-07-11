// ─── Domain 层：纯类型定义，无 IO ───
// 所有跨边界类型加 #[serde(rename_all = "camelCase")] 确保 JSON 字段名为 camelCase
// 修改任意类型后需同步更新前端 TypeScript 接口（见 src/domain/）

mod collection;
mod document;
mod package;
mod provider;
mod publish;
mod settings;
mod skill;

pub use collection::*;
pub use document::*;
pub use package::*;
pub use provider::*;
pub use publish::*;
pub use settings::*;
pub use skill::*;
