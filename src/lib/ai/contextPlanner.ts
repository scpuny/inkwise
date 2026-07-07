/**
 * contextPlanner.ts — Context Planner：按意图预检 + 精准上下文注入
 *
 * 三层预检：
 *   第1层: 关键词规则引擎（轻量，零延迟）
 *   第2层: 向量语义检索（慢但泛化，依赖 embedder）
 *   第3层: 小模型预检（最智能，预留）
 *
 * 用户输入 → 规则匹配 → ContextPlan → Agent Prompt Builder
 *
 * @see docs/plan/06-context-planner.md
 */

// ─── 类型定义 ───

/** 上下文来源类型 */
export type ContextSourceKind =
  | 'git_diff'
  | 'ast_symbols'
  | 'config_file'
  | 'vector_search'
  | 'article_series'
  | 'publish_history'
  | 'project_structure'
  | 'document_content'
  | 'selected_text';

/** 上下文范围 */
export type ContextScope = 'changed_files' | 'full_project' | 'related_only';

/** 单条上下文项 */
export interface ContextItem {
  source: ContextSourceKind;
  scope: ContextScope;
  maxTokens: number;
  priority: number; // 1-5，5最高
}

/** 上下文注入计划 */
export interface ContextPlan {
  intent: string;
  requiredContexts: ContextItem[];
  suggestedTools: string[];
  priorityFiles: string[];
  skipSections: string[];
}

/** 意图模式（关键词 → ContextPlan 映射） */
export interface IntentPattern {
  id: string;
  keywords: string[];
  plan: ContextPlan;
}

// ─── 内置意图模式 ───

const INTENT_PATTERNS: IntentPattern[] = [
  {
    id: 'changelog',
    keywords: ['变动', '更新', '修改', '重构', '修复', 'changelog', 'change', '改了什么'],
    plan: {
      intent: 'project_changelog',
      requiredContexts: [
        { source: 'git_diff', scope: 'changed_files', maxTokens: 2000, priority: 5 },
        { source: 'ast_symbols', scope: 'changed_files', maxTokens: 1000, priority: 4 },
        { source: 'config_file', scope: 'changed_files', maxTokens: 500, priority: 3 },
      ],
      suggestedTools: ['read_document', 'git_diff'],
      priorityFiles: [],
      skipSections: ['project_structure', 'document_content', 'blueprint'],
    },
  },
  {
    id: 'architecture',
    keywords: ['架构', '设计', '模块', '概览', 'overview', 'structure', '目录', '项目结构'],
    plan: {
      intent: 'architecture_review',
      requiredContexts: [
        { source: 'config_file', scope: 'full_project', maxTokens: 2000, priority: 5 },
        { source: 'ast_symbols', scope: 'full_project', maxTokens: 3000, priority: 4 },
        { source: 'project_structure', scope: 'full_project', maxTokens: 1000, priority: 3 },
      ],
      suggestedTools: ['read_project_files', 'list_project_files'],
      priorityFiles: ['README.md', 'package.json', 'Cargo.toml'],
      skipSections: ['git_diff', 'selected_text'],
    },
  },
  {
    id: 'release',
    keywords: ['发布', '上线', '部署', 'release', 'deploy', '版本'],
    plan: {
      intent: 'release_notes',
      requiredContexts: [
        { source: 'git_diff', scope: 'full_project', maxTokens: 3000, priority: 5 },
        { source: 'publish_history', scope: 'full_project', maxTokens: 500, priority: 4 },
        { source: 'config_file', scope: 'full_project', maxTokens: 1000, priority: 3 },
      ],
      suggestedTools: ['read_document', 'git_diff'],
      priorityFiles: ['CHANGELOG.md', 'package.json', 'Cargo.toml'],
      skipSections: ['vector_search', 'selected_text'],
    },
  },
  {
    id: 'writing',
    keywords: ['写', '创作', '编辑', '撰写', '起草', 'write', 'edit', 'draft', '润色', '改写'],
    plan: {
      intent: 'article_writing',
      requiredContexts: [
        { source: 'document_content', scope: 'full_project', maxTokens: 4000, priority: 5 },
        { source: 'selected_text', scope: 'related_only', maxTokens: 1000, priority: 4 },
        { source: 'article_series', scope: 'related_only', maxTokens: 1000, priority: 3 },
      ],
      suggestedTools: ['read_document', 'write_document', 'search_document'],
      priorityFiles: [],
      skipSections: ['git_diff', 'project_structure', 'ast_symbols'],
    },
  },
  {
    id: 'review',
    keywords: ['审阅', '评估', '评审', 'review', '评价', '检查', '优化', '建议'],
    plan: {
      intent: 'article_review',
      requiredContexts: [
        { source: 'document_content', scope: 'full_project', maxTokens: 4000, priority: 5 },
        { source: 'selected_text', scope: 'related_only', maxTokens: 1000, priority: 4 },
      ],
      suggestedTools: ['read_document', 'search_document'],
      priorityFiles: [],
      skipSections: ['git_diff', 'project_structure', 'ast_symbols'],
    },
  },
  {
    id: 'translate',
    keywords: ['翻译', 'translate', '英文', '中文', '英译中', '中译英'],
    plan: {
      intent: 'translation',
      requiredContexts: [
        { source: 'selected_text', scope: 'related_only', maxTokens: 2000, priority: 5 },
        { source: 'document_content', scope: 'full_project', maxTokens: 2000, priority: 3 },
      ],
      suggestedTools: ['read_document', 'write_document'],
      priorityFiles: [],
      skipSections: ['git_diff', 'project_structure', 'ast_symbols', 'tool_info'],
    },
  },
  {
    id: 'series',
    keywords: ['系列', '连载', '合集', '上下篇', '系列文章', 'series'],
    plan: {
      intent: 'series_planning',
      requiredContexts: [
        { source: 'article_series', scope: 'full_project', maxTokens: 2000, priority: 5 },
        { source: 'document_content', scope: 'full_project', maxTokens: 2000, priority: 3 },
      ],
      suggestedTools: ['read_document', 'write_document'],
      priorityFiles: [],
      skipSections: ['git_diff', 'project_structure', 'ast_symbols', 'config_file'],
    },
  },
  {
    id: 'search',
    keywords: ['搜索', '查找', '找', 'search', 'find', '查询', '检索'],
    plan: {
      intent: 'semantic_search',
      requiredContexts: [
        { source: 'vector_search', scope: 'full_project', maxTokens: 2000, priority: 5 },
        { source: 'project_structure', scope: 'full_project', maxTokens: 500, priority: 2 },
      ],
      suggestedTools: ['vector_search', 'search_project_files', 'search_document'],
      priorityFiles: [],
      skipSections: ['git_diff', 'config_file', 'selected_text'],
    },
  },
  {
    id: 'illustration',
    keywords: ['配图', '插图', '图片', '图片生成', 'illustration', 'image', '图'],
    plan: {
      intent: 'image_generation',
      requiredContexts: [
        { source: 'selected_text', scope: 'related_only', maxTokens: 500, priority: 5 },
        { source: 'document_content', scope: 'full_project', maxTokens: 2000, priority: 3 },
      ],
      suggestedTools: ['write_document'],
      priorityFiles: [],
      skipSections: ['git_diff', 'project_structure', 'ast_symbols', 'tool_info'],
    },
  },
];

/** 默认 ContextPlan（无规则匹配时使用） */
const DEFAULT_PLAN: ContextPlan = {
  intent: 'general',
  requiredContexts: [
    { source: 'document_content', scope: 'full_project', maxTokens: 4000, priority: 5 },
    { source: 'selected_text', scope: 'related_only', maxTokens: 1000, priority: 3 },
  ],
  suggestedTools: ['read_document', 'write_document', 'search_document'],
  priorityFiles: [],
  skipSections: [],
};

// ─── 关键词匹配 ───

/** 检查用户输入是否匹配关键词组 */
function matchKeywords(input: string, keywords: string[]): boolean {
  const lower = input.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// ─── 主入口 ───

/**
 * 根据用户输入、项目上下文、文章上下文和当前技能，生成 ContextPlan。
 *
 * @param userInput  用户输入文本（必填）
 * @param skillName  当前技能名称（可选，用于降级匹配）
 * @returns ContextPlan
 */
export async function planContext(
  userInput: string,
  skillName?: string,
): Promise<ContextPlan> {
  // 第1层: 关键词规则匹配
  for (const pattern of INTENT_PATTERNS) {
    if (matchKeywords(userInput, pattern.keywords)) {
      return { ...pattern.plan, requiredContexts: [...pattern.plan.requiredContexts] };
    }
  }

  // 第2层: 向量语义降级
  // 当关键词规则无法匹配时，用语义搜索理解用户意图，返回动态 ContextPlan
  try {
    const vectorPlan = await planContextWithVector(userInput);
    if (vectorPlan) return vectorPlan;
  } catch (err) {
    console.warn("[contextPlanner] Layer 2 (vector) fallback failed:", err);
  }

  // 第3层: 小模型预检（占位 — 未来扩展）
  // TODO: planContextWithLLM(userInput, projectCtx)

  // 降级：按技能名特征匹配
  if (skillName) {
    const skillLower = skillName.toLowerCase();
    if (skillLower.includes('review') || skillLower.includes('审阅')) {
      return {
        intent: 'article_review',
        requiredContexts: [
          { source: 'document_content', scope: 'full_project', maxTokens: 4000, priority: 5 },
        ],
        suggestedTools: ['read_document', 'search_document'],
        priorityFiles: [],
        skipSections: ['git_diff', 'project_structure'],
      };
    }
    if (skillLower.includes('write') || skillLower.includes('写') || skillLower.includes('创作')) {
      return {
        intent: 'article_writing',
        requiredContexts: [
          { source: 'document_content', scope: 'full_project', maxTokens: 4000, priority: 5 },
          { source: 'article_series', scope: 'related_only', maxTokens: 1000, priority: 3 },
        ],
        suggestedTools: ['read_document', 'write_document'],
        priorityFiles: [],
        skipSections: ['git_diff', 'project_structure'],
      };
    }
  }

  // 全降级: 默认计划
  return { ...DEFAULT_PLAN, requiredContexts: [...DEFAULT_PLAN.requiredContexts] };
}

/**
 * 将 ContextPlan 序列化为 Rust 后端 API 接受的 JSON 结构
 * （供 Tauri IPC 使用）
 */


// ─── 第2层：向量语义降级 ───

/**
 * 意图-查询映射表：定义每个意图的语义查询描述。
 * 当用户输入与这些描述语义相近时，返回对应意图的 ContextPlan。
 */
const INTENT_VECTOR_MAP: Array<{
  query: string;
  plan: ContextPlan;
}> = [
  {
    query: "查看项目的变更记录、更新日志、最近的修改和提交历史",
    plan: {
      intent: 'project_changelog',
      requiredContexts: [
        { source: 'vector_search', scope: 'full_project', maxTokens: 2000, priority: 5 },
        { source: 'project_structure', scope: 'changed_files', maxTokens: 500, priority: 3 },
      ],
      suggestedTools: ['read_document', 'vector_search'],
      priorityFiles: [],
      skipSections: ['selected_text', 'article_series'],
    },
  },
  {
    query: "了解项目架构、设计模式、模块划分和目录结构",
    plan: {
      intent: 'architecture_review',
      requiredContexts: [
        { source: 'project_structure', scope: 'full_project', maxTokens: 2000, priority: 5 },
        { source: 'vector_search', scope: 'full_project', maxTokens: 1000, priority: 4 },
      ],
      suggestedTools: ['read_document', 'list_project_files'],
      priorityFiles: ['README.md', 'package.json', 'Cargo.toml'],
      skipSections: ['selected_text', 'article_series'],
    },
  },
  {
    query: "写文章、创作内容、编辑文档、润色文字",
    plan: {
      intent: 'article_writing',
      requiredContexts: [
        { source: 'document_content', scope: 'full_project', maxTokens: 4000, priority: 5 },
        { source: 'vector_search', scope: 'related_only', maxTokens: 1000, priority: 3 },
      ],
      suggestedTools: ['read_document', 'write_document', 'search_document'],
      priorityFiles: [],
      skipSections: ['git_diff', 'project_structure'],
    },
  },
];

/**
 * 第2层：向量语义降级
 * 当关键词规则无法匹配时，用语义搜索理解用户意图。
 *
 * 策略：
 * 1. 用 INTENT_VECTOR_MAP 的 query 字段做语义搜索匹配
 * 2. 找到最匹配的意图返回对应 ContextPlan
 * 3. 如果语义搜索也未找到有力匹配，返回 null 降级到下一层
 */
async function planContextWithVector(userInput: string): Promise<ContextPlan | null> {
  let semanticSearchFn: typeof import('./vectorSearch').semanticSearch;
  try {
    semanticSearchFn = (await import('./vectorSearch')).semanticSearch;
  } catch {
    return null; // vectorSearch 模块不可用
  }

  // 用用户输入做语义搜索，看是否能匹配到项目相关内容
  const results = await semanticSearchFn(userInput, 5, 0.35);

  if (!results || results.length === 0) return null;

  // 对每个意图的 query 做匹配度判断
  for (const entry of INTENT_VECTOR_MAP) {
    const intentResults = await semanticSearchFn(entry.query + " " + userInput, 3, 0.5);
    if (intentResults && intentResults.length > 0 && intentResults[0].score >= 0.5) {
      return { ...entry.plan, requiredContexts: [...entry.plan.requiredContexts] };
    }
  }

  return null; // 无匹配意图
}


export function contextPlanToRpc(plan: ContextPlan): Record<string, unknown> {
  return {
    intent: plan.intent,
    required_contexts: plan.requiredContexts.map((ctx) => ({
      source: ctx.source,
      scope: ctx.scope,
      max_tokens: ctx.maxTokens,
      priority: ctx.priority,
    })),
    suggested_tools: plan.suggestedTools,
    priority_files: plan.priorityFiles,
    skip_sections: plan.skipSections,
  };
}
