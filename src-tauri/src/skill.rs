use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

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
    Expand,
    Paraphrase,
    Proofread,
    Blog,
    Novel,
    Headline,
    Email,
    KeywordExtract,
    Readability,
    Citation,
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
            Self::Expand => "expand",
            Self::Paraphrase => "paraphrase",
            Self::Proofread => "proofread",
            Self::Blog => "blog",
            Self::Novel => "novel",
            Self::Headline => "headline",
            Self::Email => "email",
            Self::KeywordExtract => "keyword-extract",
            Self::Readability => "readability",
            Self::Citation => "citation",
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
            "expand" => Some(Self::Expand),
            "paraphrase" => Some(Self::Paraphrase),
            "proofread" => Some(Self::Proofread),
            "blog" => Some(Self::Blog),
            "novel" => Some(Self::Novel),
            "headline" => Some(Self::Headline),
            "email" => Some(Self::Email),
            "keyword-extract" => Some(Self::KeywordExtract),
            "readability" => Some(Self::Readability),
            "citation" => Some(Self::Citation),
            _ => None,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub body: String,
    pub scope: SkillScope,
    pub path: String,
    pub run_as: RunAs,
    pub allowed_tools: Vec<String>,
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
            "read_document" => Some(Self::ReadDocument),
            "write_document" => Some(Self::WriteDocument),
            "search_document" => Some(Self::SearchDocument),
            "read_project_files" => Some(Self::ReadProjectFiles),
            "list_project_files" => Some(Self::ListProjectFiles),
            "search_project_files" => Some(Self::SearchProjectFiles),
            "git_diff" => Some(Self::GitDiff),
            "vector_search" => Some(Self::VectorSearch),
            "call_web_search" => Some(Self::CallWebSearch),
            _ => None,
        }
    }
}

/// 语境来源类型（与 ContextPlanner 共用）
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillContextSource {
    pub source_type: ContextSourceType,
    pub label: String,
    pub required: bool,
    pub max_tokens: Option<u32>,
}

/// 努力程度级别
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum EffortLevel {
    Low,
    Medium,
    High,
}

/// 写作阶段（对应前端 SkillPhase）
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum SkillPhase {
    Title,
    Description,
    Outline,
    Tags,
    Writing,
}

/// 阶段 AI 配置
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhaseConfigUnified {
    pub phase: SkillPhase,
    pub system_prompt: String,
    pub temperature: Option<f32>,
    pub model: Option<String>,
    pub max_tokens: Option<u32>,
}

/// 统一技能定义（前后端共用权威契约）
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


// ─── Unified Built-in Skills ───

/// 统一的 builtin 技能工厂函数
fn unified(
    name: &str, description: &str, icon: &str,
) -> UnifiedSkillBuilder {
    UnifiedSkillBuilder {
        name: name.to_string(),
        description: description.to_string(),
        icon: icon.to_string(),
        body: String::new(),
        run_as: RunAs::Inline,
        allowed_tools: Vec::new(),
        phase_configs: Vec::new(),
        context_sources: Vec::new(),
        model: None,
        effort: None,
        scope: SkillScope::Builtin,
        enabled: true,
    }
}

struct UnifiedSkillBuilder {
    name: String,
    description: String,
    icon: String,
    body: String,
    run_as: RunAs,
    allowed_tools: Vec<ToolCapability>,
    phase_configs: Vec<PhaseConfigUnified>,
    context_sources: Vec<SkillContextSource>,
    model: Option<String>,
    effort: Option<EffortLevel>,
    scope: SkillScope,
    enabled: bool,
}

impl UnifiedSkillBuilder {
    fn body(mut self, body: &str) -> Self {
        self.body = body.to_string();
        self
    }

    fn run_as(mut self, run_as: RunAs) -> Self {
        self.run_as = run_as;
        self
    }

    fn tools(mut self, tools: Vec<ToolCapability>) -> Self {
        self.allowed_tools = tools;
        self
    }

    fn phases(mut self, phases: Vec<PhaseConfigUnified>) -> Self {
        self.phase_configs = phases;
        self
    }

    fn contexts(mut self, sources: Vec<SkillContextSource>) -> Self {
        self.context_sources = sources;
        self
    }

    fn model(mut self, model: &str) -> Self {
        self.model = Some(model.to_string());
        self
    }

    fn effort(mut self, effort: EffortLevel) -> Self {
        self.effort = Some(effort);
        self
    }

    fn build(self) -> UnifiedSkill {
        UnifiedSkill {
            name: self.name,
            description: self.description,
            icon: self.icon,
            body: self.body,
            run_as: self.run_as,
            allowed_tools: self.allowed_tools,
            phase_configs: self.phase_configs,
            context_sources: self.context_sources,
            model: self.model,
            effort: self.effort,
            scope: self.scope,
            enabled: self.enabled,
        }
    }
}

/// 合并后的统一内置技能列表（替代旧的 builtin_skills() + getBuiltinSkills()）
pub fn unified_builtin_skills() -> Vec<UnifiedSkill> {
    vec![
        /* ════════════════════════════════════════════
           风格型技能（源自前端 getBuiltinSkills）
           ════════════════════════════════════════════ */

        // 1. 通用写作（默认风格）
        unified("general", "通用写作", "📝")
            .body("你是一位专业写作者。根据用户要求完成写作任务，保持文风自然得体。")
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Subagent)
            .phases(vec![
                PhaseConfigUnified { phase: SkillPhase::Title, system_prompt: "你是一位标题专家。生成简洁有力的标题。\n\n## 规则\n- 标题直接反映内容核心\n- 控制在 8-20 字\n- 直接输出，不要前缀和引号\n- 只输出一行".into(), temperature: Some(0.7), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Description, system_prompt: "写一段引人入胜的文章简介。\n\n## 规则\n- 概括文章核心价值或观点\n- 吸引目标读者\n- 20-60 字\n- 直接输出".into(), temperature: Some(0.7), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Outline, system_prompt: "为文章生成逻辑清晰的大纲。\n\n## 输出格式\n编号列表，每行一个章节。\n\n## 规则\n- 控制在 3-6 个章节\n- 逻辑递进".into(), temperature: Some(0.7), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Tags, system_prompt: "生成标签。\n\n## 规则\n- 3-5 个标签，用空格分隔\n- 覆盖核心主题".into(), temperature: Some(0.7), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Writing, system_prompt: "以通用写作风格撰写内容。\n\n## 要求\n- 段落 3-5 行\n- 句式多样\n- 语气自然得体\n- 遵循 Markdown 格式\n- 正文内标题从 ## 开始".into(), temperature: Some(0.7), model: None, max_tokens: Some(4096) },
            ])
            .build(),

        // 2. 学术严谨
        unified("academic", "学术严谨", "🔬")
            .body("# 学术写作\n\n严谨、客观的学术写作风格。\n\n## 规则\n- 使用客观、中立的语气\n- 每个论点需有论据支撑\n- 避免主观评价和情感化表达\n- 引用格式规范".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument, ToolCapability::SearchDocument])
            .run_as(RunAs::Subagent)
            .effort(EffortLevel::High)
            .phases(vec![
                PhaseConfigUnified { phase: SkillPhase::Title, system_prompt: "你是一位学术标题专家。为研究论文生成严谨、准确的标题。\n\n## 规则\n- 标题直接反映研究内容\n- 前 6 字包含核心研究对象\n- 使用规范学术术语\n- 10-25 字\n- 直接输出一行".into(), temperature: Some(0.4), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Description, system_prompt: "写一段学术摘要。\n\n## 规则\n- 概括研究目的、方法、主要发现和结论\n- 50-120 字\n- 客观第三人称\n- 直接输出一行".into(), temperature: Some(0.4), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Outline, system_prompt: "为学术文章生成严谨递进的大纲。\n\n## 结构\n引言 → 文献综述 → 方法 → 结果 → 讨论 → 结论\n\n## 规则\n- 5-8 个章节\n- 每章节附简要说明".into(), temperature: Some(0.4), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Tags, system_prompt: "生成规范学术关键词标签。\n\n## 规则\n- 覆盖研究领域、方法、主要概念\n- 3-6 个，空格分隔".into(), temperature: Some(0.4), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Writing, system_prompt: "你是一位学术写作专家。撰写严谨、客观的学术内容。\n\n## 开篇\n- 第一段直接点明研究背景和问题\n- 快速过渡到核心目标和方法\n\n## 语言\n- 客观第三人称，避免主观评价\n- 句子控制在 40 字以内\n- 段落 3-6 行\n\n## 格式\n- 遵循 Markdown 语法\n- 标题从 ## 开始\n- 引用使用标准学术格式".into(), temperature: Some(0.5), model: None, max_tokens: Some(4096) },
            ])
            .build(),

        // 3. 博客口语
        unified("blog", "博客口语", "📢")
            .body("# 博客写作\n\n轻松自然的博客风格。\n\n## 风格要求\n- 口语化但不随意\n- 段落短小精悍（3-5 句一段）\n- 有明确的观点和态度".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Subagent)
            .phases(vec![
                PhaseConfigUnified { phase: SkillPhase::Title, system_prompt: "为博客生成让人忍不住点开的标题。\n\n## 规则\n- 有「钩子」：设问、反差、数字、具体收益\n- 10-22 字\n- 直接输出一行".into(), temperature: Some(0.85), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Writing, system_prompt: "以轻松自然的博客风格撰写。\n\n## 开篇\n- 用具体场景、个人经历或反差问题切入\n- 前 2 段亮出文章核心价值\n\n## 语气\n- 口语化但不随意\n- 用「你」拉近距离\n\n## 结构\n- 段落 3-5 行\n- 长短段交替\n\n## 格式\n- 标题从 ## 开始\n- 代码块标注语言".into(), temperature: Some(0.8), model: None, max_tokens: Some(4096) },
            ])
            .build(),

        // 4. 创意写作
        unified("creative", "创意写作", "✨")
            .body("# 创意写作\n\n富有文学性和想象力的创作风格。\n\n## 写作规则\n- 使用文学性语言\n- 注重修辞手法\n- 控制节奏和韵律\n- 增强画面感和感染力".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Subagent)
            .phases(vec![
                PhaseConfigUnified { phase: SkillPhase::Title, system_prompt: "为文学作品生成诗意标题。\n\n## 规则\n- 有意境、有画面感\n- 4-15 字\n- 直接输出一行".into(), temperature: Some(0.9), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Writing, system_prompt: "以创意文学风格撰写。\n\n## 开篇\n- 从具体意象、场景或哲思切入\n- 第一段建立氛围\n\n## 语言\n- 注重节奏感和音乐性\n- 多用具象感性词汇\n- 善用比喻、拟人\n\n## 叙事\n- Show, don't tell\n- 用细节和场景代替抽象描述\n\n## 格式\n- 标题从 ## 开始".into(), temperature: Some(0.9), model: None, max_tokens: Some(4096) },
            ])
            .build(),

        // 5. 社交流行
        unified("viral", "社交流行", "📱")
            .body("# 社交流行写作\n\n高传播性内容风格，适合公众号、社交媒体。\n\n## 要求\n- 信息密度高\n- 有态度、有情绪\n- 段落短小".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Subagent)
            .phases(vec![
                PhaseConfigUnified { phase: SkillPhase::Title, system_prompt: "生成让人忍不住点击的高传播标题。\n\n## 规则\n- 制造好奇缺口\n- 可使用数字、对比、反转\n- 10-26 字\n- 直接输出一行".into(), temperature: Some(0.9), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Writing, system_prompt: "以社交传播风格撰写。\n\n## 开头\n- 冲击性事实、反常识观点、痛点场景\n- 第一句抓住注意力\n\n## 结构\n- 段落 2-4 行\n- 视觉节奏丰富\n- 结尾引发评论或转发\n\n## 格式\n- 标题从 ## 开始".into(), temperature: Some(0.85), model: None, max_tokens: Some(4096) },
            ])
            .build(),

        // 6. 技术教程
        unified("tutorial", "技术教程", "💻")
            .body("# 技术教程写作\n\n清晰实用的技术教程风格。\n\n## 要求\n- 步骤式推进\n- 解释「为什么这样做」\n- 代码示例可运行".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Subagent)
            .contexts(vec![
                SkillContextSource { source_type: ContextSourceType::Project, label: "关联项目目录".into(), required: false, max_tokens: Some(4000) },
            ])
            .phases(vec![
                PhaseConfigUnified { phase: SkillPhase::Title, system_prompt: "为技术教程生成清晰标题。\n\n## 规则\n- 包含核心技术点\n- 可包含版本号\n- 8-22 字\n- 直接输出一行".into(), temperature: Some(0.5), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Writing, system_prompt: "以技术教程风格撰写。\n\n## 开篇\n- 展示最终效果或目标\n- 交代受众和前置知识\n\n## 结构\n- 步骤式推进\n- 指出常见坑点\n\n## 代码\n- 代码必须可运行\n- 代码块标注语言\n- 核心逻辑加注释\n\n## 格式\n- 标题从 ## 开始".into(), temperature: Some(0.6), model: None, max_tokens: Some(4096) },
            ])
            .build(),

        // 7. 商业文案
        unified("business", "商业文案", "📦")
            .body("# 商业文案写作\n\n有说服力的商业文案风格。\n\n## 要求\n- 突出价值主张\n- 用数据支撑观点\n- 有明确 CTA".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Subagent)
            .phases(vec![
                PhaseConfigUnified { phase: SkillPhase::Title, system_prompt: "为商业内容生成有说服力的标题。\n\n## 规则\n- 突出价值主张\n- 使用具体数字\n- 10-22 字\n- 直接输出一行".into(), temperature: Some(0.8), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Writing, system_prompt: "以商业文案风格撰写。\n\n## 结构\n- 以用户痛点切入\n- 突出价值主张\n- 结构：吸引→建立信任→说服→转化\n\n## 语言\n- 用数据、案例支撑\n- 避免空洞套话\n\n## 结尾\n- 明确 CTA\n- 制造紧迫感\n\n## 格式\n- 标题从 ## 开始".into(), temperature: Some(0.75), model: None, max_tokens: Some(4096) },
            ])
            .build(),

        // 8. 新闻报道
        unified("news", "新闻报道", "📰")
            .body("# 新闻报道写作\n\n客观中立的新闻报道风格。\n\n## 要求\n- 倒金字塔结构\n- 5W1H 覆盖\n- 客观陈述".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Subagent)
            .phases(vec![
                PhaseConfigUnified { phase: SkillPhase::Title, system_prompt: "为新闻报道生成客观准确标题。\n\n## 规则\n- 主语+谓语+宾语直述结构\n- 10-22 字\n- 直接输出一行".into(), temperature: Some(0.4), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Writing, system_prompt: "以新闻报道风格撰写。\n\n## 结构\n- 倒金字塔结构\n- 最重要信息在最前面\n- 每段独立信息单元\n\n## 语言\n- 客观中立\n- 引用标明来源\n\n## 格式\n- 标题从 ## 开始".into(), temperature: Some(0.5), model: None, max_tokens: Some(4096) },
            ])
            .build(),

        // 9. 营销文案
        unified("marketing", "营销文案", "🎯")
            .body("# 营销文案写作\n\n有转化力的营销文案风格。\n\n## 要求\n- 突出核心卖点\n- 激发欲望\n- 降低决策门槛".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Subagent)
            .phases(vec![
                PhaseConfigUnified { phase: SkillPhase::Title, system_prompt: "为营销内容生成高转化标题。\n\n## 规则\n- 突出核心卖点和用户利益\n- 8-18 字\n- 直接输出一行".into(), temperature: Some(0.85), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Writing, system_prompt: "以营销文案风格撰写。\n\n## 结构\n- 吸引注意→激发兴趣→建立信任→促成行动\n- 指出痛点→呈现方案→排除异议\n\n## 语言\n- 用「你」拉近距离\n- 有力的动词和具体数字\n\n## 结尾\n- 明确 CTA\n- 制造紧迫感\n\n## 格式\n- 标题从 ## 开始".into(), temperature: Some(0.75), model: None, max_tokens: Some(4096) },
            ])
            .build(),

        // 10. 产品文档
        unified("product-doc", "产品文档", "📖")
            .body("# 产品文档写作\n\n清晰准确的产品文档风格。\n\n## 要求\n- 客观准确\n- 步骤式操作说明\n- 规范的术语".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Subagent)
            .contexts(vec![
                SkillContextSource { source_type: ContextSourceType::Project, label: "关联项目目录".into(), required: false, max_tokens: Some(4000) },
            ])
            .phases(vec![
                PhaseConfigUnified { phase: SkillPhase::Title, system_prompt: "为产品文档生成清晰标题。\n\n## 规则\n- 直接反映文档内容\n- 6-18 字\n- 直接输出一行".into(), temperature: Some(0.3), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Writing, system_prompt: "以产品文档风格撰写。\n\n## 语气\n- 客观、准确、中立\n\n## 结构\n- 概述→快速开始→核心概念→操作指南→参考\n- 先说明「是什么」再说明「怎么用」\n\n## 格式\n- 代码块标注语言\n- 表格用于参数说明".into(), temperature: Some(0.3), model: None, max_tokens: Some(4096) },
            ])
            .build(),

        // 11. 评论鉴赏
        unified("review", "评论鉴赏", "🎬")
            .body("# 评论写作\n\n有深度、有态度的评论风格。\n\n## 要求\n- 多维分析\n- 具体例证支撑\n- 有见地但不武断".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Subagent)
            .phases(vec![
                PhaseConfigUnified { phase: SkillPhase::Title, system_prompt: "为评论文章生成有态度的标题。\n\n## 规则\n- 体现核心观点或评价立场\n- 8-20 字\n- 直接输出一行".into(), temperature: Some(0.8), model: None, max_tokens: None },
                PhaseConfigUnified { phase: SkillPhase::Writing, system_prompt: "以评论风格撰写。\n\n## 开篇\n- 给出总体评价或核心观点\n- 用具体细节切入\n\n## 结构\n- 多维度分析\n- 具体例证支撑\n- 标注剧透\n\n## 语言\n- 精准的鉴赏术语\n- 有感性体悟也有理性分析\n\n## 格式\n- 标题从 ## 开始".into(), temperature: Some(0.75), model: None, max_tokens: Some(4096) },
            ])
            .build(),

        /* ════════════════════════════════════════════
           动作型技能（源自 Rust builtin_skills）
           ════════════════════════════════════════════ */

        // 12. 续写
        unified("continue-writing", "续写", "✍️")
            .body("# 继续写作\n\n从光标位置继续写作，保持文风和内容连贯。\n\n## 规则\n- 保持原文的语气和风格\n- 延续当前段落的主题\n- 自然过渡，不突兀".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 13. 改写
        unified("rewrite", "改写", "🔄")
            .body("# 改写\n\n根据用户要求改写选中的文本。保持原意，提升表达质量。".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 14. 润色
        unified("polish", "润色", "✨")
            .body("# 润色\n\n润色文本，修正语法问题，优化表达，保持原意和风格。".into())
            .tools(vec![ToolCapability::ReadDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 15. 翻译
        unified("translate", "翻译", "🌐")
            .body("# 翻译\n\n将文本翻译为目标语言。保持原意和文体风格。".into())
            .tools(vec![ToolCapability::ReadDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 16. 摘要
        unified("summary", "摘要", "📋")
            .body("# 摘要\n\n阅读文档内容，生成简洁准确的摘要。\n\n## 要求\n- 概括核心观点\n- 保持客观\n- 控制在原文 20% 长度以内".into())
            .tools(vec![ToolCapability::ReadDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 17. 大纲
        unified("outline", "大纲", "📑")
            .body("# 大纲生成\n\n阅读文档内容，生成或优化层级清晰的大纲结构。\n\n## 规则\n- 提取核心论点和章节\n- 保持层级结构合理\n- 每个节点使用简洁的短语".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 18. 扩写
        unified("expand", "扩写", "📈")
            .body("# 扩写\n\n对现有文本进行扩写，丰富内容和细节。\n\n## 规则\n- 保持原文的核心观点和语气\n- 补充具体论据、例子或数据\n- 不改变原文的结构框架".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 19. 同义改写
        unified("paraphrase", "同义改写", "🔄")
            .body("# 同义改写\n\n保持原意不变，改变句式和措辞，生成改写版本。\n\n## 规则\n- 保留原文的全部关键信息\n- 改变句子结构和表达方式".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 20. 校对
        unified("proofread", "校对", "✅")
            .body("# 校对\n\n检查文本中的语法错误、错别字和标点问题。\n\n## 检查项目\n- 错别字和用词不当\n- 语法错误\n- 标点符号使用不当".into())
            .tools(vec![ToolCapability::ReadDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 21. 标题生成
        unified("headline", "标题生成", "🏷️")
            .body("# 标题生成\n\n根据文章内容生成多个高质量的标题。\n\n## 规则\n- 每个标题控制在 10-25 字\n- 提供不同风格：直白型、悬念型、数字型、提问型".into())
            .tools(vec![ToolCapability::ReadDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 22. 邮件写作
        unified("email", "邮件写作", "📧")
            .body("# 邮件写作\n\n根据场景和收件人撰写不同风格的邮件。\n\n## 风格选项\n- 正式：用于上级、客户\n- 半正式：用于同事\n- 非正式：用于团队成员".into())
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 23. 关键词提取
        unified("keyword-extract", "关键词提取", "🔑")
            .body("# 关键词提取\n\n分析文档内容，提取核心关键词和标签。\n\n## 规则\n- 提取 5-10 个关键词\n- 区分核心关键词和扩展标签".into())
            .tools(vec![ToolCapability::ReadDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 24. 可读性优化
        unified("readability", "可读性优化", "📊")
            .body("# 可读性优化\n\n分析文本的可读性，提供具体改进建议。\n\n## 评估维度\n- 句子长度：建议平均 15-25 字\n- 段落长度：建议 3-5 句一段".into())
            .tools(vec![ToolCapability::ReadDocument])
            .run_as(RunAs::Inline)
            .build(),

        // 25. 引用格式
        unified("citation", "引用格式", "📚")
            .body("# 引用格式生成\n\n根据提供的文献信息，生成规范的引用格式。\n\n## 支持的格式\n- APA 第 7 版\n- MLA 第 9 版\n- GB/T 7714".into())
            .tools(vec![ToolCapability::ReadDocument])
            .run_as(RunAs::Inline)
            .build(),
    ]
}
// ─── Frontmatter parser (minimal, no deps) ───

#[derive(Default)]
struct Frontmatter {
    name: Option<String>,
    description: Option<String>,
    run_as: Option<String>,
    model: Option<String>,
    effort: Option<String>,
    allowed_tools: Option<String>,
}

fn parse_frontmatter(content: &str) -> (Frontmatter, String) {
    let content = content.trim();
    if !content.starts_with("---") {
        return (Frontmatter::default(), content.to_string());
    }

    let end = content[3..].find("---").map(|p| p + 6);
    match end {
        Some(end_pos) => {
            let fm_str = &content[3..end_pos - 3];
            let body = content[end_pos..].trim().to_string();
            let mut fm = Frontmatter::default();

            for line in fm_str.lines() {
                let line = line.trim();
                if let Some((key, value)) = line.split_once(':') {
                    let key = key.trim().to_lowercase();
                    let value = value.trim().trim_matches('"').trim().to_string();
                    match key.as_str() {
                        "name" => fm.name = Some(value),
                        "description" => fm.description = Some(value),
                        "runas" | "run_as" => fm.run_as = Some(value),
                        "model" => fm.model = Some(value),
                        "effort" => fm.effort = Some(value),
                        "allowed-tools" | "allowed_tools" => fm.allowed_tools = Some(value),
                        _ => {}
                    }
                }
            }
            (fm, body)
        }
        None => (Frontmatter::default(), content.to_string()),
    }
}
pub struct SkillStore {
    roots: Vec<PathBuf>,
    builtins: Vec<Skill>,
}

impl SkillStore {
    pub fn new(global_skills_dir: PathBuf, project_skills_dir: Option<PathBuf>) -> Self {
        let mut roots = Vec::new();

        // Global scope: ~/.reasonix/skills/, ~/.inkwise/skills/
        for name in &[".reasonix", ".inkwise"] {
            let dir = global_skills_dir.parent().map(|p| p.join(name).join("skills"))
                .unwrap_or_else(|| global_skills_dir.join(name).join("skills"));
            roots.push(dir);
        }

        // Project scope
        if let Some(project_dir) = project_skills_dir {
            roots.push(project_dir);
        }

        // Remove non-existent
        roots.retain(|p| p.exists());

        SkillStore {
            roots,
            builtins: Vec::new(),
        }
    }

    /// Discover all skills across all roots
    pub fn list(&self) -> Vec<Skill> {
        let mut skills: Vec<Skill> = Vec::new();
        let mut seen = HashMap::new();

        for root in &self.roots {
            self.discover_in(root, SkillScope::Global, &mut seen, &mut skills);
        }

        // Add builtins last (lowest priority)
        for b in &self.builtins {
            if !seen.contains_key(&b.name) {
                skills.push(b.clone());
            }
        }

        skills
    }

    fn discover_in(&self, dir: &Path, scope: SkillScope, seen: &mut HashMap<String, usize>, out: &mut Vec<Skill>) {
        if !dir.is_dir() { return; }
        let entries = match std::fs::read_dir(dir) {
            Ok(e) => e,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // Directory layout: <name>/SKILL.md
                let skill_md = path.join("SKILL.md");
                if skill_md.exists() {
                    if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                        if !seen.contains_key(name) {
                            if let Some(skill) = self.load_from(&skill_md, name, &scope) {
                                seen.insert(name.to_string(), out.len());
                                out.push(skill);
                            }
                        }
                    }
                }
            } else if path.extension().map_or(false, |e| e == "md") {
                // Flat layout: <name>.md
                if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                    if stem == "SKILL" { continue; }
                    if !seen.contains_key(stem) {
                        if let Some(skill) = self.load_from(&path, stem, &scope) {
                            seen.insert(stem.to_string(), out.len());
                            out.push(skill);
                        }
                    }
                }
            }
        }
    }

    fn load_from(&self, path: &Path, default_name: &str, scope: &SkillScope) -> Option<Skill> {
        let content = std::fs::read_to_string(path).ok()?;
        let (fm, body) = parse_frontmatter(&content);

        let name = fm.name.clone().unwrap_or_else(|| default_name.to_string());
        let description = fm.description.unwrap_or_default();
        let run_as = match fm.run_as.as_deref() {
            Some("subagent") => RunAs::Subagent,
            _ => RunAs::Inline,
        };
        let allowed_tools = fm.allowed_tools
            .unwrap_or_default()
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        Some(Skill {
            name,
            description,
            body,
            scope: scope.clone(),
            path: path.to_string_lossy().to_string(),
            run_as,
            allowed_tools,
            model: fm.model,
            effort: fm.effort,
            enabled: true,
        })
    }

    /// Find a skill by name (across all scopes)
    pub fn find(&self, name: &str) -> Option<Skill> {
        let skills = self.list();
        skills.into_iter().find(|s| s.name == name)
    }

    /// Install a new skill
    pub fn install(&self, name: &str, description: &str, body: &str, run_as: &RunAs) -> Result<String, String> {
        let root = self.roots.first().ok_or("没有可用的 skills 目录")?;
        let skill_dir = root.join(name);
        std::fs::create_dir_all(&skill_dir).map_err(|e| e.to_string())?;

        let run_as_str = match run_as {
            RunAs::Inline => "inline",
            RunAs::Subagent => "subagent",
        };

        let content = format!(
            "---\nname: {}\ndescription: {}\nrunAs: {}\n---\n\n{}",
            name, description, run_as_str, body
        );

        let path = skill_dir.join("SKILL.md");
        std::fs::write(&path, &content).map_err(|e| e.to_string())?;
        Ok(path.to_string_lossy().to_string())
    }

    /// Register a builtin skill
    pub fn add_builtin(&mut self, skill: Skill) {
        self.builtins.push(skill);
    }
}

// ─── Built-in skills ───

pub fn builtin_skills() -> Vec<Skill> {
    vec![
        Skill {
            name: "continue-writing".into(),
            description: "从光标位置继续写作，保持文风和内容连贯".into(),
            body: "# 继续写作\n\n阅读当前文档末尾内容，保持文风一致地续写。\n\n## 规则\n- 保持原文的语气和风格\n- 延续当前段落的主题\n- 自然过渡，不突兀".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into(), "write_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "rewrite".into(),
            description: "改写选中文本，提升表达质量，可指定风格".into(),
            body: "# 改写\n\n根据用户要求改写选中的文本。保持原意，提升表达质量。".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into(), "write_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "polish".into(),
            description: "润色文本，使语言更加流畅自然".into(),
            body: "# 润色\n\n润色文本，修正语法问题，优化表达，保持原意和风格。".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "translate".into(),
            description: "翻译文本（默认中译英或英译中）".into(),
            body: "# 翻译\n\n将文本翻译为目标语言。保持原意和文体风格。".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "academic".into(),
            description: "学术写作风格：严谨、客观、引用规范".into(),
            body: "# 学术写作风格\n\n## 写作规则\n- 使用客观、中立的语气\n- 每个论点需有论据支撑\n- 避免主观评价和情感化表达\n- 使用规范的学术术语\n\n## 结构要求\n- 遵循引言-正文-结论的结构\n- 段落之间逻辑连贯\n- 引用格式规范\n\n## 语言要求\n- 句子结构完整\n- 避免口语化表达\n- 专业术语使用准确".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Subagent,
            allowed_tools: vec!["read_document".into(), "write_document".into(), "search_document".into()],
            model: None,
            effort: Some("high".into()),
            enabled: true,
        },
        Skill {
            name: "creative".into(),
            description: "创意写作风格：富有文学性和感染力".into(),
            body: "# 创意写作\n\n## 写作规则\n- 使用文学性语言\n- 注重修辞手法（比喻、拟人、排比等）\n- 控制节奏和韵律\n- 增强画面感和感染力\n\n## 技巧\n- 长短句交替使用\n- 适当使用修辞问句\n- 细节描写增强代入感".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into(), "write_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "summary".into(),
            description: "为文档生成简洁准确的摘要".into(),
            body: "# 摘要\n\n阅读文档内容，生成简洁准确的摘要。\n\n## 要求\n- 概括核心观点\n- 保持客观\n- 控制在原文 20% 长度以内".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "outline".into(),
            description: "根据文档内容自动生成或优化大纲结构".into(),
            body: "# 大纲生成\n\n阅读文档内容，生成或优化层级清晰的大纲结构。\n\n## 规则\n- 提取核心论点和章节\n- 保持层级结构合理（h1 → h2 → h3）\n- 每个节点使用简洁的短语\n- 覆盖文档的所有关键内容\n\n## 输出格式\n- Markdown 列表格式\n- 每项保持 4-10 字".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into(), "write_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "expand".into(),
            description: "对选中段落或论点进行扩写，补充论据和细节".into(),
            body: "# 扩写\n\n对现有文本进行扩写，丰富内容和细节。\n\n## 规则\n- 保持原文的核心观点和语气\n- 补充具体论据、例子或数据\n- 增加描写细节，增强画面感\n- 不改变原文的结构框架\n- 扩写后的内容与上下文自然衔接".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into(), "write_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "paraphrase".into(),
            description: "同义改写，保留原意改变句式表达".into(),
            body: "# 同义改写\n\n保持原意不变，改变句式和措辞，生成改写版本。\n\n## 规则\n- 保留原文的全部关键信息\n- 改变句子结构和表达方式\n- 提供多种改写风格选项\n- 保持与原文相同的正式程度\n- 避免改变原文的情感倾向".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into(), "write_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "proofread".into(),
            description: "语法校对、错别字检查、标点修正".into(),
            body: "# 校对\n\n检查文本中的语法错误、错别字和标点问题。\n\n## 检查项目\n- 错别字和用词不当\n- 语法错误（主谓搭配、语序等）\n- 标点符号使用不当\n- 中英文混排空格规范\n- 数字和单位格式规范\n\n## 输出格式\n每处问题标注：所在位置 → 问题类型 → 修改建议".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "blog".into(),
            description: "博客写作风格：口语化、段落短、有观点".into(),
            body: "# 博客写作\n\n以轻松自然的博客风格撰写内容。\n\n## 风格要求\n- 口语化但不随意，保持可读性\n- 段落短小精悍（3-5 句一段）\n- 有明确的观点和态度\n- 适当使用设问句与读者互动\n- 开头要有吸引力\n- 结尾要有总结或行动号召".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into(), "write_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "novel".into(),
            description: "小说写作风格：描写细腻、对话自然、节奏控制".into(),
            body: "# 小说写作\n\n以文学创作的方式撰写叙事性内容。\n\n## 写作规则\n- 环境描写要服务于氛围和人物\n- 对话要符合人物性格和身份\n- 控制叙事节奏，张弛有度\n- 使用多种叙事视角切换\n- 注重细节描写（五感体验）\n- 避免陈词滥调\n\n## 技巧\n- 倒叙、插叙等叙事手法\n- 人物动作展现性格而非直接说明\n- 对话中的潜台词".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Subagent,
            allowed_tools: vec!["read_document".into(), "write_document".into(), "search_document".into()],
            model: None,
            effort: Some("high".into()),
            enabled: true,        },
        Skill {
            name: "headline".into(),
            description: "为文章生成多个吸引眼球的标题建议".into(),
            body: "# 标题生成\n\n根据文章内容生成多个高质量的标题。\n\n## 规则\n- 每个标题控制在 10-25 字\n- 提供不同风格：直白型、悬念型、数字型、提问型\n- 标题要准确反映内容核心\n- 避免标题党\n- 考虑目标读者群体\n\n## 输出格式\n列出 5-8 个标题，每个标题标注风格类型".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "email".into(),
            description: "邮件写作：正式、半正式、商务邮件".into(),
            body: "# 邮件写作\n\n根据场景和收件人撰写不同风格的邮件。\n\n## 风格选项\n- 正式：用于上级、客户、官方沟通\n- 半正式：用于同事、合作伙伴\n- 非正式：用于熟络的团队成员\n\n## 结构\n- 清晰的邮件主题\n- 得体的称呼和问候\n- 正文逻辑清晰，先说结论\n- 有明确的行动号召或请求\n- 礼貌的结束语和署名\n\n## 规则\n- 根据收件人选择适当的礼貌程度\n- 避免过长段落\n- 重要信息使用列表突出".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into(), "write_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "keyword-extract".into(),
            description: "从文章提取关键词和标签".into(),
            body: "# 关键词提取\n\n分析文档内容，提取核心关键词和标签。\n\n## 规则\n- 提取 5-10 个关键词\n- 区分核心关键词和扩展标签\n- 考虑领域术语和常见表述\n- 关键词应覆盖文档的主要主题\n\n## 输出格式\n- 核心关键词：3-5 个\n- 扩展标签：5-8 个\n- 每个词附带权重或相关性评分".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "readability".into(),
            description: "可读性评估与优化建议".into(),
            body: "# 可读性优化\n\n分析文本的可读性，提供具体改进建议。\n\n## 评估维度\n- 句子长度：建议平均 15-25 字\n- 段落长度：建议 3-5 句一段\n- 词汇难度：难词比例\n- 被动语态使用频率\n- 连接词使用是否恰当\n\n## 优化建议\n- 拆分过长的句子\n- 合并零散的短句\n- 替换生僻难懂的词汇\n- 增加过渡词改善段落衔接\n- 统一术语使用".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
        Skill {
            name: "citation".into(),
            description: "引用格式生成（支持常见引用规范）".into(),
            body: "# 引用格式生成\n\n根据提供的文献信息，生成规范的引用格式。\n\n## 支持的格式\n- APA 第 7 版\n- MLA 第 9 版\n- GB/T 7714（中国标准）\n- Chicago Manual of Style\n\n## 输入要求\n提供文献的基本信息：作者、标题、出版年份、出版社/期刊名、卷期页码、DOI/URL\n\n## 输出\n- 正文内引用（in-text citation）\n- 参考文献列表条目（reference list）\n- 按不同格式分别输出".into(),
            scope: SkillScope::Builtin,
            path: "(builtin)".into(),
            run_as: RunAs::Inline,
            allowed_tools: vec!["read_document".into()],
            model: None,
            effort: None,
            enabled: true,        },
    ]
}
