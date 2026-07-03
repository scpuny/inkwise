use serde::{Deserialize, Serialize};


// ─── Types ───

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum SkillScope {
    Builtin,
    Global,
    Custom,
    Project,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum RunAs {
    Inline,
    Subagent,
}

/// 写作动作类型（替代字符串 skill name，类型安全）
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum WritingActionKind {
    ContinueWriting,
    Rewrite,
    Polish,
    Translate,
    Academic,
    Creative,
    Summary,
    Outline,
    Novel,
    Headline,
    Email,
    KeywordExtract,
    Readability,
    Citation,
    Changelog,
    ProjectOverview,
    ImpactAssessment,
    Custom(String),
}

impl WritingActionKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ContinueWriting => "continue-writing",
            Self::Rewrite => "rewrite",
            Self::Polish => "polish",
            Self::Translate => "translate",
            Self::Academic => "academic",
            Self::Creative => "creative",
            Self::Summary => "summary",
            Self::Outline => "outline",
            Self::Novel => "novel",
            Self::Headline => "headline",
            Self::Email => "email",
            Self::KeywordExtract => "keyword-extract",
            Self::Readability => "readability",
            Self::Citation => "citation",
            Self::Changelog => "changelog",
            Self::ProjectOverview => "project-overview",
            Self::ImpactAssessment => "impact-assessment",
            Self::Custom(_) => "custom",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "continue-writing" => Some(Self::ContinueWriting),
            "rewrite" => Some(Self::Rewrite),
            "polish" => Some(Self::Polish),
            "translate" => Some(Self::Translate),
            "academic" => Some(Self::Academic),
            "creative" => Some(Self::Creative),
            "summary" => Some(Self::Summary),
            "outline" => Some(Self::Outline),
            "novel" => Some(Self::Novel),
            "headline" => Some(Self::Headline),
            "email" => Some(Self::Email),
            "keyword-extract" => Some(Self::KeywordExtract),
            "readability" => Some(Self::Readability),
            "citation" => Some(Self::Citation),
            "changelog" => Some(Self::Changelog),
            "project-overview" => Some(Self::ProjectOverview),
            "impact-assessment" => Some(Self::ImpactAssessment),
            _ => None,
        }
    }
}

/// 旧版 Skill 结构（兼容 v1.x，逐步迁移到 UnifiedSkill）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub body: String,
    pub scope: SkillScope,
    pub path: String,
    pub run_as: RunAs,
    pub allowed_tools: Vec<ToolCapability>,
    pub model: Option<String>,
    pub effort: Option<String>,
    pub enabled: bool,
}

// ─── Unified Skill Types (v2.0.0) ───

/// 工具能力枚举（类型安全，替换旧版 String）
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ToolCapability {
    ReadDocument,
    WriteDocument,
    SearchDocument,
    ReadProjectFiles,
    ListProjectFiles,
    SearchProjectFiles,
    GitDiff,
    VectorSearch,
    CallWebSearch,
}

impl ToolCapability {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::ReadDocument => "read_document",
            Self::WriteDocument => "write_document",
            Self::SearchDocument => "search_document",
            Self::ReadProjectFiles => "read_project_files",
            Self::ListProjectFiles => "list_project_files",
            Self::SearchProjectFiles => "search_project_files",
            Self::GitDiff => "git_diff",
            Self::VectorSearch => "vector_search",
            Self::CallWebSearch => "call_web_search",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "read_document" | "read-document" => Some(Self::ReadDocument),
            "write_document" | "write-document" => Some(Self::WriteDocument),
            "search_document" | "search-document" => Some(Self::SearchDocument),
            "read_project_files" | "read-project-files" => Some(Self::ReadProjectFiles),
            "list_project_files" | "list-project-files" => Some(Self::ListProjectFiles),
            "search_project_files" | "search-project-files" => Some(Self::SearchProjectFiles),
            "git_diff" | "git-diff" => Some(Self::GitDiff),
            "vector_search" | "vector-search" => Some(Self::VectorSearch),
            "call_web_search" | "call-web-search" => Some(Self::CallWebSearch),
            _ => None,
        }
    }
}

/// 语境来源类型（和 ContextPlanner 共用）
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ContextSourceType {
    Project,
    Series,
    LinkedFolder,
    CustomText,
    GitDiff,
    AstAnalysis,
    VectorSearch,
    PublishHistory,
}

impl ContextSourceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Project => "project",
            Self::Series => "series",
            Self::LinkedFolder => "linked_folder",
            Self::CustomText => "custom_text",
            Self::GitDiff => "git_diff",
            Self::AstAnalysis => "ast_analysis",
            Self::VectorSearch => "vector_search",
            Self::PublishHistory => "publish_history",
        }
    }
}

/// 语境来源配置
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillContextSource {
    pub source_type: ContextSourceType,
    pub label: String,
    pub required: bool,
    pub max_tokens: Option<u32>,
}

/// 努力程度
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum EffortLevel {
    Low,
    Medium,
    High,
}

/// 写作阶段
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum SkillPhase {
    Title,
    Description,
    Outline,
    Tags,
    Writing,
}

/// 阶段配置
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhaseConfigUnified {
    pub phase: SkillPhase,
    pub system_prompt: String,
    pub temperature: Option<f32>,
    pub model: Option<String>,
    pub max_tokens: Option<u32>,
}

/// 统一 Skill 定义（v2.0.0，新旧系统共用）
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UnifiedSkill {
    pub name: String,
    pub description: String,
    pub icon: String,
    pub body: String,
    pub run_as: RunAs,
    pub allowed_tools: Vec<ToolCapability>,
    pub phase_configs: Vec<PhaseConfigUnified>,
    pub context_sources: Vec<SkillContextSource>,
    pub model: Option<String>,
    pub effort: Option<EffortLevel>,
    pub scope: SkillScope,
    pub enabled: bool,
}
