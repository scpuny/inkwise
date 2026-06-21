import { isTauriEnv, tryInvoke, invokeOrFallback } from "./tauri";

export type SkillScope = "Builtin" | "Global" | "Custom" | "Project";
export type RunAs = "Inline" | "Subagent";

export interface Skill {
  name: string;
  description: string;
  body: string;
  scope: SkillScope;
  path: string;
  run_as: RunAs;
  allowed_tools: string[];
  model?: string | null;
  effort?: string | null;
  enabled: boolean;
}

export interface AgentResult {
  content: string;
  steps: string[];
}

export async function listSkills(): Promise<Skill[]> {
  if (isTauriEnv()) {
    try {
      return await tryInvoke<Skill[]>("list_skills");
    } catch { /* fallback */ }
  }
  return getBuiltinSkills();
}

export async function readSkill(name: string): Promise<Skill | null> {
  if (isTauriEnv()) {
    try {
      return await tryInvoke<Skill | null>("read_skill", { name });
    } catch { /* fallback */ }
  }
  const builtin = await getBuiltinSkills();
  return builtin.find((s) => s.name === name) ?? null;
}

export async function runSkill(
  name: string,
  userInput: string,
  documentContent?: string,
  selectedText?: string,
  blueprint?: any,
  currentSectionId?: string,
): Promise<AgentResult> {
  if (isTauriEnv()) {
    try {
      return await tryInvoke<AgentResult>("run_skill", {
        name,
        userInput,
        documentContent: documentContent ?? "",
        selectedText: selectedText ?? "",
        blueprint: blueprint ?? null,
        currentSectionId: currentSectionId ?? null,
      });
    } catch (e: any) {
      return { content: `调用失败: ${e?.message ?? e}`, steps: [] };
    }
  }
  // Browser fallback
  return {
    content: `[Skill: ${name}] 请在桌面版中使用 Skills 功能。\n\n用户输入: ${userInput}`,
    steps: ["分析请求", "执行写作"],
  };
}

export async function getBuiltinSkills(): Promise<Skill[]> {
  // Called from browser mode; Tauri mode uses list_skills
  return getFallbackSkills();
}

export async function installSkill(name: string, description: string, body: string, runAs: string): Promise<string> {
  if (isTauriEnv()) {
    try {
      return await tryInvoke<string>("install_skill", { name, description, body, runAs });
    } catch (e: any) {
      throw new Error(`安装失败: ${e?.message ?? e}`);
    }
  }
  throw new Error("安装 Skill 仅在桌面版可用");
}

export async function generateSkillBody(name: string, description: string): Promise<string> {
  if (isTauriEnv()) {
    try {
      return await tryInvoke<string>("generate_skill", { name, description });
    } catch (e: any) {
      throw new Error(`生成失败: ${e?.message ?? e}`);
    }
  }
  return `# ${name}\n\n${description}\n\n## 规则\n- 保持原意\n- 语言流畅\n\n## 输出要求\n- 直接输出结果`;
}

export function getFallbackSkills(): Skill[] {
  return [
    { name: "continue-writing", description: "从光标位置继续写作，保持文风和内容连贯", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "rewrite", description: "改写选中文本，提升表达质量", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "polish", description: "润色文本，使语言更加流畅自然", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
    { name: "translate", description: "翻译文本（默认中译英或英译中）", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
    { name: "academic", description: "学术写作风格：严谨、客观、引用规范", body: "", scope: "Builtin", path: "(builtin)", run_as: "Subagent", allowed_tools: ["read_document", "write_document", "search_document"], model: null, effort: "high", enabled: true },
    { name: "creative", description: "创意写作风格：富有文学性和感染力", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "summary", description: "为文档生成摘要", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
    { name: "outline", description: "根据文档内容自动生成或优化大纲结构", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "expand", description: "对选中段落或论点进行扩写，补充论据和细节", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "paraphrase", description: "同义改写，保留原意改变句式表达", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "proofread", description: "语法校对、错别字检查、标点修正", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
    { name: "blog", description: "博客写作风格：口语化、段落短、有观点", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "novel", description: "小说写作风格：描写细腻、对话自然、节奏控制", body: "", scope: "Builtin", path: "(builtin)", run_as: "Subagent", allowed_tools: ["read_document", "write_document", "search_document"], model: null, effort: "high", enabled: true },
    { name: "headline", description: "为文章生成多个吸引眼球的标题建议", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
    { name: "email", description: "邮件写作：正式、半正式、商务邮件", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "keyword-extract", description: "从文章提取关键词和标签", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
    { name: "readability", description: "可读性评估与优化建议，改善文章结构", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
    { name: "citation", description: "引用格式生成（支持 APA/MLA/GB/T 等规范）", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
  ];
}
