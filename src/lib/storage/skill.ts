import { isTauriEnv, tryInvoke, invokeOrFallback, TauriCommands } from "../bridge/tauri";

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
      return await tryInvoke<Skill[]>(TauriCommands.ListSkills);
    } catch { /* fallback */ }
  }
  return getBuiltinSkills();
}

export async function readSkill(name: string): Promise<Skill | null> {
  if (isTauriEnv()) {
    try {
      return await tryInvoke<Skill | null>(TauriCommands.ReadSkill, { name });
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
  projectPath?: string,
  model?: string | null,
  providerId?: string | null,
): Promise<AgentResult> {
  if (isTauriEnv()) {
    try {
      return await tryInvoke<AgentResult>(TauriCommands.RunSkill, {
        name,
        userInput,
        documentContent: documentContent ?? "",
        selectedText: selectedText ?? "",
        blueprint: blueprint ?? null,
        currentSectionId: currentSectionId ?? null,
        projectPath: projectPath ?? null,
        model: model ?? null,
        providerId: providerId ?? null,
      });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      // Clean up verbose API errors for display
      const clean = msg
        .replace(/^API 错误 \(\d+\): /, '')
        .replace(/\{"error":\{.*?\}\}/s, '')
        .replace(/OpenAIException - /, '')
        .trim();
      throw new Error(clean || 'AI 服务暂时不可用，请检查 API 状态后重试');
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

export async function setSkillEnabled(name: string, enabled: boolean): Promise<void> {
  if (isTauriEnv()) {
    try {
      await tryInvoke(TauriCommands.SetSkillEnabled, { name, enabled });
    } catch {}
  }
}

export async function deleteSkill(name: string): Promise<void> {
  if (isTauriEnv()) {
    try {
      await tryInvoke(TauriCommands.DeleteSkill, { name });
    } catch {}
  }
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
    { name: "polish", description: "润色文本，使语言更加流畅自然", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
    { name: "rewrite", description: "改写选中文本，提升表达质量", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "translate", description: "翻译文本（默认中译英或英译中）", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
    { name: "expand", description: "对选中段落或论点进行扩写，补充论据和细节", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "continue-writing", description: "从光标位置继续写作，保持文风和内容连贯", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "paraphrase", description: "同义改写，保留原意改变句式表达", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document", "write_document"], model: null, effort: null, enabled: true },
    { name: "proofread", description: "语法校对、错别字检查、标点修正", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
    { name: "summary", description: "为文档生成摘要", body: "", scope: "Builtin", path: "(builtin)", run_as: "Inline", allowed_tools: ["read_document"], model: null, effort: null, enabled: true },
  ];
}

/**
 * Stream a skill execution via Tauri events.
 * Falls back to non-streaming runSkill in browser mode.
 */
export async function runSkillStream(
  name: string,
  userInput: string,
  onToken: (token: string) => void,
  documentContent?: string,
  selectedText?: string,
  blueprint?: any,
  currentSectionId?: string,
  projectPath?: string,
  model?: string | null,
  providerId?: string | null,
): Promise<string> {
  if (!isTauriEnv()) {
    const result = await runSkill(name, userInput, documentContent, selectedText, blueprint, currentSectionId, projectPath, model, providerId);
    return result.content;
  }

  const { listen } = await import("@tauri-apps/api/event");
  let accumulated = "";
  let unlistenToken: () => void;
  let unlistenDone: () => void;
  let unlistenError: () => void;

  return new Promise<string>((resolve, reject) => {
    // Set up listeners first
    (async () => {
      try {
        unlistenToken = await listen<{ token: string }>("chat:token", (event) => {
          accumulated += event.payload.token;
          onToken(accumulated);
        });

        unlistenDone = await listen<{ content: string }>("chat:done", async (event) => {
          accumulated = event.payload.content;
          onToken(accumulated);
          unlistenToken();
          unlistenDone();
          unlistenError();
          resolve(accumulated);
        });

        unlistenError = await listen<{ error: string }>("chat:error", async (event) => {
          unlistenToken();
          unlistenDone();
          unlistenError();
          const clean = event.payload.error
            .replace(/^API 错误 \(\d+\): /, '')
            .replace(/\{"error":\{.*?\}\}/s, '')
            .replace(/OpenAIException - /, '')
            .trim();
          reject(new Error(clean || 'AI 服务暂时不可用'));
        });

        // Start the skill
        tryInvoke(TauriCommands.RunSkill, {
          name,
          userInput,
          documentContent: documentContent ?? "",
          selectedText: selectedText ?? "",
          blueprint: blueprint ?? null,
          currentSectionId: currentSectionId ?? null,
          model: model ?? null,
          providerId: providerId ?? null,
        }).catch((e: any) => {
          unlistenToken?.();
          unlistenDone?.();
          unlistenError?.();
          reject(new Error(e?.message || String(e)));
        });
      } catch (e: any) {
        reject(new Error(e?.message || String(e)));
      }
    })();
  });
}
