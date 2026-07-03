use super::types::*;

// ─── Old Built-in Skills (v1.x compatibility) ───

pub fn builtin_skills() -> Vec<Skill> {
    vec![
        Skill {
            name: "continue-writing".into(),
            description: "续写：从当前位置继续写作".into(),
            body: "你是一位 AI 写作助手。请根据上下文自然流畅地续写下文。\n\n要求：\n- 保持原文的语言风格和叙述角度\n- 逻辑衔接自然，不突兀\n- 不要在中间插入元评论（\u{201C}我在这里续写...\u{201D}）\n- 如果上下文不充分，合理推断但不要编造事实".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Inline,
            allowed_tools: vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument],
            model: None,
            effort: Some("medium".into()),
            enabled: true,
        },
        Skill {
            name: "rewrite".into(),
            description: "改写：重新组织语言，优化表达".into(),
            body: "请改写以下文本，保留核心信息但重新组织语言。\n\n要求：\n- 保持原文事实不变\n- 提升表达的清晰度和流畅度\n- 优化段落结构\n- 不要添加原文没有的内容\n- 输出时只在开头用一句话说明改写的重点".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Subagent,
            allowed_tools: vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument, ToolCapability::SearchDocument],
            model: None,
            effort: Some("high".into()),
            enabled: true,
        },
        Skill {
            name: "polish".into(),
            description: "润色：修正语法错误，完善表达".into(),
            body: "请润色以下文本。\n\n要求：\n- 修正错别字和语法错误\n- 优化拗口的表达\n- 保持原文的风格和信息\n- 最小化改动，不改不必要的词汇".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Subagent,
            allowed_tools: vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument],
            model: None,
            effort: Some("low".into()),
            enabled: true,
        },
        Skill {
            name: "translate".into(),
            description: "翻译：中英互译，保持原文风格".into(),
            body: "请翻译以下文本。\n\n要求：\n- 准确传达原文意思\n- 符合目标语言的表达习惯\n- 保留原文的语气和风格\n- 技术术语保持行业内通用译名\n- 直接输出译文，不要对比".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Subagent,
            allowed_tools: vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument],
            model: None,
            effort: Some("high".into()),
            enabled: true,
        },
        Skill {
            name: "academic".into(),
            description: "学术：严谨论述，逻辑严密".into(),
            body: "请以学术写作风格处理以下文本。\n\n要求：\n- 逻辑严谨，论证有据\n- 使用规范的学术用语\n- 适当引用相关研究或数据\n- 段落之间有清晰的逻辑递进\n- 避免主观臆断，每个观点需有支撑".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Subagent,
            allowed_tools: vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument],
            model: None,
            effort: Some("high".into()),
            enabled: true,
        },
        Skill {
            name: "creative".into(),
            description: "创意：放飞想象力，文笔生动".into(),
            body: "请以创意写作风格处理以下文本。\n\n要求：\n- 语言生动形象，富有感染力\n- 可以使用比喻、拟人等修辞手法\n- 叙事有节奏感\n- 敢于打破常规表达\n- 保持可读性，不要让修辞过度影响理解".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Subagent,
            allowed_tools: vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument],
            model: None,
            effort: Some("medium".into()),
            enabled: true,
        },
        Skill {
            name: "summary".into(),
            description: "摘要：提取核心要点".into(),
            body: "请为以下文本写一份简洁的摘要。\n\n要求：\n- 提取 3-5 个核心要点\n- 每个要点一句话\n- 保留关键数据或结论\n- 不要添加原文没有的信息\n- 总字数控制在原文的 20% 以内".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Subagent,
            allowed_tools: vec![ToolCapability::ReadDocument],
            model: None,
            effort: Some("low".into()),
            enabled: true,
        },
        Skill {
            name: "outline".into(),
            description: "大纲：规划文章结构".into(),
            body: "请根据主题生成文章大纲。\n\n要求：\n- 结构层次分明\n- 每个章节标题要有信息量\n- 标注每个部分的预期字数\n- 考虑读者认知递进\n- 输出格式：编号列表".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Subagent,
            allowed_tools: vec![ToolCapability::ReadDocument],
            model: None,
            effort: Some("medium".into()),
            enabled: true,
        },
        Skill {
            name: "novel".into(),
            description: "小说：故事创作".into(),
            body: "请进行小说创作。\n\n要求：\n- 塑造鲜明的角色形象\n- 情节有起伏和悬念\n- 场景描写生动具体\n- 对话符合角色性格\n- 控制叙事节奏".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Subagent,
            allowed_tools: vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument],
            model: None,
            effort: Some("high".into()),
            enabled: true,
        },
        Skill {
            name: "headline".into(),
            description: "标题：撰写吸引眼球的标题".into(),
            body: "请为文章撰写标题。\n\n要求：\n- 标题要有信息量，不要标题党\n- 控制在 15-25 字\n- 突出文章核心卖点\n- 可以包含数字或关键词\n- 直接输出标题，不要解释".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Inline,
            allowed_tools: vec![ToolCapability::ReadDocument],
            model: None,
            effort: Some("medium".into()),
            enabled: true,
        },
        Skill {
            name: "email".into(),
            description: "邮件：正式邮件写作".into(),
            body: "请撰写正式邮件。\n\n要求：\n- 邮件格式完整规范\n- 语气恰当（根据收件人调整正式程度）\n- 内容清晰有条理\n- 包含必要的礼貌用语".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Subagent,
            allowed_tools: vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument],
            model: None,
            effort: Some("medium".into()),
            enabled: true,
        },
        Skill {
            name: "keyword-extract".into(),
            description: "关键词：提取核心关键词".into(),
            body: "请提取文本的核心关键词。\n\n要求：\n- 提取 5-10 个关键词\n- 按重要性降序排列\n- 每个关键词 2-6 个字\n- 覆盖文章主要主题\n- 输出格式：逗号分隔".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Inline,
            allowed_tools: vec![ToolCapability::ReadDocument],
            model: None,
            effort: Some("low".into()),
            enabled: true,
        },
        Skill {
            name: "readability".into(),
            description: "可读性：优化文章可读性".into(),
            body: "请优化以下文本的可读性。\n\n要求：\n- 拆解长句为短句（每句不超过 30 字）\n- 用更简单的词汇替换生僻词\n- 增加过渡句衔接段落\n- 优化分段（每段不超过 6 行）\n- 保持原文的信息量和专业度".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Subagent,
            allowed_tools: vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument],
            model: None,
            effort: Some("medium".into()),
            enabled: true,
        },
        Skill {
            name: "citation".into(),
            description: "引用：规范引用格式".into(),
            body: "请规范化引文格式。\n\n要求：\n- 统一引用格式（APA/MLA/Chicago 等）\n- 补充缺失的引用信息\n- 检查引用和参考文献的对应关系\n- 标注需要补充出处的内容".into(),
            scope: SkillScope::Builtin,
            path: String::new(),
            run_as: RunAs::Subagent,
            allowed_tools: vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument],
            model: None,
            effort: Some("medium".into()),
            enabled: true,
        },
    ]
}

// ─── Unified Built-in Skills (v2.0.0) ───

pub struct UnifiedSkillBuilder {
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
}

impl UnifiedSkillBuilder {
    fn new(name: &str, description: &str) -> Self {
        Self {
            name: name.to_string(),
            description: description.to_string(),
            icon: String::new(),
            body: String::new(),
            run_as: RunAs::Inline,
            allowed_tools: Vec::new(),
            phase_configs: Vec::new(),
            context_sources: Vec::new(),
            model: None,
            effort: None,
        }
    }

    pub fn icon(mut self, icon: &str) -> Self {
        self.icon = icon.to_string();
        self
    }

    pub fn body(mut self, body: &str) -> Self {
        self.body = body.to_string();
        self
    }

    pub fn run_as(mut self, run_as: RunAs) -> Self {
        self.run_as = run_as;
        self
    }

    pub fn tools(mut self, tools: Vec<ToolCapability>) -> Self {
        self.allowed_tools = tools;
        self
    }

    pub fn phases(mut self, phases: Vec<PhaseConfigUnified>) -> Self {
        self.phase_configs = phases;
        self
    }

    pub fn contexts(mut self, contexts: Vec<SkillContextSource>) -> Self {
        self.context_sources = contexts;
        self
    }

    pub fn model(mut self, model: &str) -> Self {
        self.model = Some(model.to_string());
        self
    }

    pub fn effort(mut self, effort: EffortLevel) -> Self {
        self.effort = Some(effort);
        self
    }

    pub fn build(&self) -> UnifiedSkill {
        UnifiedSkill {
            name: self.name.clone(),
            description: self.description.clone(),
            icon: self.icon.clone(),
            body: self.body.clone(),
            run_as: self.run_as.clone(),
            allowed_tools: self.allowed_tools.clone(),
            phase_configs: self.phase_configs.clone(),
            context_sources: self.context_sources.clone(),
            model: self.model.clone(),
            effort: self.effort.clone(),
            scope: SkillScope::Builtin,
            enabled: true,
        }
    }
}

pub fn unified_builtin_skills() -> Vec<UnifiedSkill> {
    vec![
        // ─── 风格类（Style Skills）───
        UnifiedSkillBuilder::new("general", "通用写作")
            .icon("✍️")
            .body("平衡得体的通用写作风格，适合大多数场景。要求语言流畅、逻辑清晰。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("academic", "学术严谨")
            .icon("🎓")
            .body("严谨的学术写作风格。要求逻辑严密、论证充分、使用规范的学术用语。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("blog", "博客随笔")
            .icon("📝")
            .body("轻松自然的博客风格。娓娓道来，有个性有态度，注重可读性和互动感。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("creative", "创意文学")
            .icon("🎨")
            .body("富有文学性和想象力的创意写作。注重修辞、节奏感和感染力。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("media-viral", "爆款新媒体")
            .icon("🔥")
            .body("吸引眼球的新媒体风格。短句、强节奏、高信息密度，适合社交媒体传播。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("tech-tutorial", "技术教程")
            .icon("💻")
            .body("清晰易懂的技术教程风格。注重实操、代码示例和逐步讲解，兼顾专业性与易读性。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("business", "商务专业")
            .icon("💼")
            .body("专业得体的商务写作风格。简洁、高效、目标导向，适合商业沟通和报告。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("news", "新闻资讯")
            .icon("📰")
            .body("客观中立的新闻写作风格。倒金字塔结构，事实先行，信息准确。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("marketing", "营销文案")
            .icon("📢")
            .body("有说服力的营销文案风格。强调卖点、转化率和行动号召。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("product-doc", "产品文档")
            .icon("📋")
            .body("清晰准确的产品文档风格。结构清晰、术语统一、用户导向。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("review", "评论测评")
            .icon("⭐")
            .body("公正有见地的评论风格。分析优缺点，给出明确结论和建议。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),

        // ─── 动作类（Action Skills）───
        UnifiedSkillBuilder::new("continue-writing", "续写")
            .icon("▶️")
            .body("根据上下文自然流畅地续写下文。保持原文语言风格和叙述角度，逻辑衔接自然。")
            .run_as(RunAs::Inline)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("rewrite", "改写")
            .icon("🔄")
            .body("重新组织语言，优化表达。保留核心信息但提升清晰度和流畅度。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("polish", "润色")
            .icon("✨")
            .body("修正语法错误，完善表达。最小化改动，保持原文风格和信息。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument])
            .build(),
        UnifiedSkillBuilder::new("translate", "翻译")
            .icon("🌐")
            .body("中英互译，保持原文风格。准确传达意思，符合目标语言表达习惯。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument])
            .build(),
        UnifiedSkillBuilder::new("summary", "摘要")
            .icon("📄")
            .body("提取 3-5 个核心要点。保留关键数据或结论，不添加原文没有的信息。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument])
            .build(),
        UnifiedSkillBuilder::new("outline", "大纲")
            .icon("📋")
            .body("根据主题生成文章大纲。结构层次分明，每个标题有信息量。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
        UnifiedSkillBuilder::new("headline", "标题")
            .icon("🏷️")
            .body("为文章撰写有信息量的标题。控制在 15-25 字，突出核心卖点。")
            .run_as(RunAs::Inline)
            .tools(vec![ToolCapability::ReadDocument])
            .build(),
        UnifiedSkillBuilder::new("email", "邮件")
            .icon("📧")
            .body("撰写正式邮件。格式完整规范，语气恰当，内容清晰有条理。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument])
            .build(),
        UnifiedSkillBuilder::new("keyword-extract", "关键词")
            .icon("🔑")
            .body("提取 5-10 个核心关键词，按重要性降序排列。")
            .run_as(RunAs::Inline)
            .tools(vec![ToolCapability::ReadDocument])
            .build(),
        UnifiedSkillBuilder::new("readability", "可读性优化")
            .icon("📖")
            .body("优化文章可读性：拆解长句、简化词汇、增加过渡、优化分段。")
            .run_as(RunAs::Subagent)
            .tools(vec![ToolCapability::ReadDocument, ToolCapability::WriteDocument])
            .build(),
    ]
}
