// builtins.ts [DEPRECATED] — 旧版内置技能定义
// @deprecated 请使用 ../unifiedSkills.ts 中的 unified_builtin_skills 或 IPC 获取。将在 v2.0.0 后移除。
// 优先从 Rust 端通过 IPC 获取统一技能列表，浏览器模式下滑为本地定义
import type { WritingSkill } from "./types";
import { getUnifiedSkills } from "../unifiedSkills";
import type { UnifiedSkill } from "../skillTypes";
import { isTauriEnv } from "../../bridge/tauri";

/* ─── UnifiedSkill → WritingSkill 转换（后向兼容） ─── */

function unifiedToLegacy(unified: UnifiedSkill, id: string): WritingSkill {
  const configs: Record<string, { systemPrompt: string; temperature?: number; model?: string; maxTokens?: number }> = {};
  for (const pc of unified.phaseConfigs) {
    configs[pc.phase] = {
      systemPrompt: pc.systemPrompt,
      temperature: pc.temperature,
      model: pc.model,
      maxTokens: pc.maxTokens,
    };
  }

  return {
    id,
    name: unified.description,
    description: unified.description,
    icon: unified.icon,
    scope: "full",
    configs,
    contextSources: unified.contextSources.map((cs) => ({
      type: cs.sourceType as "project" | "series" | "linked_folder" | "custom_text",
      label: cs.label,
      required: cs.required,
      maxLength: cs.maxTokens,
    })),
    tools: [],
    dimensions: [],
    builtin: unified.scope === "builtin",
    createdAt: 0,
    updatedAt: 0,
  };
}

/* ─── 内置技能工厂 ─── */

function builtin(id: string, partial: Omit<WritingSkill, "id" | "builtin" | "createdAt" | "updatedAt">): WritingSkill {
  return { id, builtin: true, createdAt: 0, updatedAt: 0, ...partial };
}

/* ─── 本地降级定义（浏览器模式） ─── */

function getLocalBuiltinSkills(): WritingSkill[] {
  return [
    builtin("general", {
      name: "通用写作", description: "平衡得体的通用写作风格，适合大多数场景", icon: "📝",
      scope: "full", configs: {}, contextSources: [],
      dimensions: [{ name: "正式度", value: 5 }, { name: "修辞密度", value: 5 }, { name: "叙事性", value: 5 }],
    }),

    builtin("academic", {
      name: "学术严谨", description: "严谨客观的学术写作风格，适合论文、研究报告等正式内容", icon: "🔬",
      scope: "full", configs: {
        title: { systemPrompt: "为研究论文生成严谨、准确的标题。\n\n## 规则\n- 标题直接反映研究内容\n- 使用规范学术术语\n- 10-25 字", temperature: 0.4 },
        writing: { systemPrompt: "以学术风格撰写内容。\n\n## 语言\n- 客观第三人称\n- 段落 3-6 行\n\n## 格式\n- 标题从 ## 开始", temperature: 0.5, maxTokens: 4096 },
      }, contextSources: [],
      dimensions: [{ name: "正式度", value: 9 }, { name: "修辞密度", value: 3 }, { name: "叙事性", value: 2 }],
    }),

    builtin("blog", {
      name: "博客口语", description: "轻松自然的博客风格，适合技术博客、个人分享等场景", icon: "📢",
      scope: "full", configs: {
        title: { systemPrompt: "为博客生成有「钩子」的标题。\n\n## 规则\n- 设问、反差、数字\n- 10-22 字", temperature: 0.85 },
        writing: { systemPrompt: "以博客风格撰写。\n\n## 开篇\n- 用具体场景切入\n\n## 语气\n- 用「你」拉近距离\n\n## 结构\n- 段落 3-5 行", temperature: 0.8, maxTokens: 4096 },
      }, contextSources: [],
      dimensions: [{ name: "正式度", value: 4 }, { name: "修辞密度", value: 7 }, { name: "叙事性", value: 6 }],
    }),

    builtin("creative", {
      name: "创意写作", description: "富有文学性和想象力的创作风格，适合小说、散文等创意内容", icon: "✨",
      scope: "full", configs: {
        title: { systemPrompt: "为文学作品生成诗意标题。\n\n## 规则\n- 有意境、有画面感\n- 4-15 字", temperature: 0.9 },
        writing: { systemPrompt: "以创意文学风格撰写。\n\n## 语言\n- 注重节奏感\n- 善用比喻、拟人\n\n## 叙事\n- Show, don't tell", temperature: 0.9, maxTokens: 4096 },
      }, contextSources: [],
      dimensions: [{ name: "正式度", value: 3 }, { name: "修辞密度", value: 9 }, { name: "叙事性", value: 9 }],
    }),

    builtin("viral", {
      name: "社交流行", description: "高传播性的社交内容风格，适合公众号、社交媒体等平台", icon: "📱",
      scope: "full", configs: {
        title: { systemPrompt: "生成高传播标题。\n\n## 规则\n- 制造好奇缺口\n- 10-26 字", temperature: 0.9 },
        writing: { systemPrompt: "以社交传播风格撰写。\n\n## 结构\n- 段落 2-4 行\n- 结尾引发评论或转发", temperature: 0.85, maxTokens: 4096 },
      }, contextSources: [],
      dimensions: [{ name: "正式度", value: 3 }, { name: "修辞密度", value: 7 }, { name: "叙事性", value: 5 }],
    }),

    builtin("tutorial", {
      name: "技术教程", description: "清晰实用的技术教程风格，适合编程教学、软件使用指南等", icon: "💻",
      scope: "full", configs: {
        title: { systemPrompt: "为技术教程生成清晰标题。\n\n## 规则\n- 包含核心技术点\n- 8-22 字", temperature: 0.5 },
        writing: { systemPrompt: "以技术教程风格撰写。\n\n## 结构\n- 步骤式推进\n- 代码必须可运行", temperature: 0.6, maxTokens: 4096 },
      },
      contextSources: [{ type: "project", label: "关联项目目录", required: false }],
      dimensions: [{ name: "正式度", value: 6 }, { name: "修辞密度", value: 3 }, { name: "叙事性", value: 3 }],
    }),

    builtin("business", {
      name: "商业文案", description: "有说服力的商业文案风格，适合产品介绍、营销内容、品牌故事", icon: "📦",
      scope: "full", configs: {
        title: { systemPrompt: "为商业内容生成有说服力的标题。\n\n## 规则\n- 突出价值主张\n- 10-22 字", temperature: 0.8 },
        writing: { systemPrompt: "以商业文案风格撰写。\n\n## 结构\n- 吸引→建立信任→说服→转化\n\n## 结尾\n- 明确 CTA", temperature: 0.75, maxTokens: 4096 },
      }, contextSources: [],
      dimensions: [{ name: "正式度", value: 6 }, { name: "修辞密度", value: 7 }, { name: "叙事性", value: 5 }],
    }),

    builtin("news", {
      name: "新闻报道", description: "客观中立的新闻报道风格，适合资讯、事件报道、行业动态", icon: "📰",
      scope: "full", configs: {
        title: { systemPrompt: "为新闻报道生成客观准确标题。\n\n## 规则\n- 主语+谓语+宾语直述结构\n- 10-22 字", temperature: 0.4 },
        writing: { systemPrompt: "以新闻报道风格撰写。\n\n## 结构\n- 倒金字塔结构\n- 客观中立", temperature: 0.5, maxTokens: 4096 },
      }, contextSources: [],
      dimensions: [{ name: "正式度", value: 8 }, { name: "修辞密度", value: 3 }, { name: "叙事性", value: 5 }],
    }),

    builtin("marketing", {
      name: "营销文案", description: "有说服力的营销文案风格，适合广告文案、品牌推广", icon: "🎯",
      scope: "full", configs: {
        title: { systemPrompt: "为营销内容生成高转化标题。\n\n## 规则\n- 突出核心卖点和用户利益\n- 8-18 字", temperature: 0.85 },
        writing: { systemPrompt: "以营销文案风格撰写。\n\n## 语言\n- 用「你」拉近距离\n\n## 结尾\n- 明确 CTA", temperature: 0.75, maxTokens: 4096 },
      }, contextSources: [],
      dimensions: [{ name: "正式度", value: 5 }, { name: "修辞密度", value: 8 }, { name: "叙事性", value: 4 }],
    }),

    builtin("product-doc", {
      name: "产品文档", description: "清晰准确的产品文档风格，适合产品说明书、API 文档", icon: "📖",
      scope: "full", configs: {
        title: { systemPrompt: "为产品文档生成清晰标题。\n\n## 规则\n- 直接反映文档内容\n- 6-18 字", temperature: 0.3 },
        writing: { systemPrompt: "以产品文档风格撰写。\n\n## 语气\n- 客观、准确、中立\n\n## 结构\n- 概述→快速开始→操作指南", temperature: 0.3, maxTokens: 4096 },
      },
      contextSources: [{ type: "project", label: "关联项目目录", required: false }],
      dimensions: [{ name: "正式度", value: 8 }, { name: "修辞密度", value: 2 }, { name: "叙事性", value: 2 }],
    }),

    builtin("review", {
      name: "书评影评", description: "有见地的评论风格，适合书评、影评、作品赏析", icon: "🎬",
      scope: "full", configs: {
        title: { systemPrompt: "为评论文章生成有态度的标题。\n\n## 规则\n- 体现核心观点或评价立场\n- 8-20 字", temperature: 0.8 },
        writing: { systemPrompt: "以评论风格撰写。\n\n## 结构\n- 多维度分析\n- 具体例证支撑", temperature: 0.75, maxTokens: 4096 },
      }, contextSources: [],
      dimensions: [{ name: "正式度", value: 6 }, { name: "修辞密度", value: 7 }, { name: "叙事性", value: 7 }],
    }),
  ];
}

/* ─── 公开 API（IPC 优先） ─── */

/** 获取内置技能列表：IPC 优先，浏览器模式降级本地 */
export async function getBuiltinSkillsAsync(): Promise<WritingSkill[]> {
  if (isTauriEnv()) {
    try {
      const unified = await getUnifiedSkills();
      const styles = unified.filter((s) => s.phaseConfigs.length > 0);
      if (styles.length > 0) {
        return styles.map((s, i) => {
          const ids = ["general", "academic", "blog", "creative", "viral", "tutorial", "business", "news", "marketing", "product-doc", "review"];
          return unifiedToLegacy(s, ids[i] || s.name);
        });
      }
    } catch {
      // fallback
    }
  }
  return getLocalBuiltinSkills();
}

/** 同步获取内置技能列表（保持旧接口兼容，始终返回本地定义） */
export function getBuiltinSkills(): WritingSkill[] {
  return getLocalBuiltinSkills();
}

/** 获取所有内置技能（含本地 + IPC） */
export function getAllBuiltinSkills(): WritingSkill[] {
  return getLocalBuiltinSkills();
}
