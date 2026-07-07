// storage.ts [DEPRECATED] — 旧版技能存储层
// @deprecated 请通过 IPC (tryInvoke/ListUnifiedSkills) 获取统一技能列表。将在 v2.0.0 后移除。
// 优先通过 IPC 从 Rust 端获取技能列表，Tauri 不可用时降级 localStorage
import { tryInvoke, isTauriEnv, TauriCommands } from "../../bridge/tauri";
import type { WritingSkill, SkillPhase, PhaseConfig } from "./types";
import { getBuiltinSkills } from "./builtins";
import { getUnifiedSkills } from "../skill/unified";
import { DEFAULT_PHASE_CONFIGS } from "./defaults";

/* ─── 工具函数 ─── */

/** 按 ID 查找技能（在 custom 列表中查找，fallback 到内置） */
export function findSkill(id: string, customs?: WritingSkill[]): WritingSkill | undefined {
  const all = [...(customs || []), ...getBuiltinSkills()];
  return all.find((s) => s.id === id);
}

/** 获取默认技能（通用写作） */
export function getDefaultSkill(): WritingSkill {
  return getBuiltinSkills()[0];
}

/** 获取某个阶段生效的配置（技能配置优先，fallback 到默认） */
export function getEffectivePhaseConfig(
  skill: WritingSkill | undefined,
  phase: SkillPhase,
): PhaseConfig {
  const phaseConfig = skill?.configs?.[phase];
  const defaults = DEFAULT_PHASE_CONFIGS[phase];
  if (!phaseConfig) return defaults;
  return {
    systemPrompt: phaseConfig.systemPrompt ?? defaults.systemPrompt,
    temperature: phaseConfig.temperature ?? defaults.temperature,
    model: phaseConfig.model ?? defaults.model,
    maxTokens: phaseConfig.maxTokens ?? defaults.maxTokens,
  };
}

/** 获取技能支持的阶段列表 */
export function getSkillPhases(skill: WritingSkill): SkillPhase[] {
  if (skill.scope === "phase" && skill.phase) return [skill.phase];
  return ["title", "description", "outline", "tags", "writing"];
}

/** 生成新技能的 ID */
export function generateSkillId(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 创建空的技能模板（用于自定义编辑） */
export function createEmptySkill(): WritingSkill {
  return {
    id: generateSkillId(),
    name: "",
    description: "",
    icon: "📝",
    scope: "full",
    configs: {},
    contextSources: [],
    tools: [],
    dimensions: [
      { name: "正式度", value: 5 },
      { name: "修辞密度", value: 5 },
      { name: "叙事性", value: 5 },
    ],
    builtin: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

/* ─── 存储 ─── */

const CUSTOM_SKILLS_KEY = "inkwise-custom-skills";

/** 加载自定义技能 */
export async function loadCustomSkills(): Promise<WritingSkill[]> {
  // Tauri 模式：从 Rust 后端加载
  if (isTauriEnv()) {
    try {
      return await tryInvoke<WritingSkill[]>(TauriCommands.ListWritingSkills);
    } catch { /* fallback */ }
  }
  // 浏览器模式：localStorage 降级
  try {
    const raw = localStorage.getItem(CUSTOM_SKILLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** 保存自定义技能 */
export async function saveCustomSkill(skill: WritingSkill): Promise<void> {
  skill.updatedAt = Date.now();
  if (isTauriEnv()) {
    try {
      await tryInvoke(TauriCommands.SaveWritingSkill, { skill });
      return;
    } catch { /* fallback */ }
  }
  const skills = await loadCustomSkills();
  const idx = skills.findIndex((s) => s.id === skill.id);
  if (idx >= 0) skills[idx] = skill;
  else skills.push(skill);
  localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(skills));
}

/** 删除自定义技能 */
export async function deleteCustomSkill(id: string): Promise<void> {
  if (isTauriEnv()) {
    try {
      await tryInvoke(TauriCommands.DeleteWritingSkill, { id });
      return;
    } catch { /* fallback */ }
  }
  const skills = await loadCustomSkills();
  localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(skills.filter((s) => s.id !== id)));
}

/** 合并内置 + 自定义技能列表 */
export async function getAllSkills(): Promise<WritingSkill[]> {
  const customs = await loadCustomSkills();
  const builtins = getBuiltinSkills();
  const merged = new Map<string, WritingSkill>();

  // 尝试从 IPC 获取统一技能列表作为内置技能
  if (isTauriEnv()) {
    try {
      const unified = await getUnifiedSkills();
      const styleSkills = unified.filter((s) => s.phaseConfigs.length > 0);
      if (styleSkills.length > 0) {
        const ids = ["general", "academic", "blog", "creative", "viral", "tutorial", "business", "news", "marketing", "product-doc", "review"];
        styleSkills.forEach((s, i) => {
          const legacy: WritingSkill = {
            id: ids[i] || s.name,
            name: s.description,
            description: s.description,
            icon: s.icon,
            scope: "full",
            configs: Object.fromEntries(s.phaseConfigs.map((pc) => [pc.phase, {
              systemPrompt: pc.systemPrompt,
              temperature: pc.temperature,
              model: pc.model,
              maxTokens: pc.maxTokens,
            }])),
            contextSources: s.contextSources.map((cs) => ({
              type: "project" as const,
              label: cs.label,
              required: cs.required,
              maxLength: cs.maxTokens,
            })),
            tools: [],
            dimensions: [],
            builtin: true,
            createdAt: 0,
            updatedAt: 0,
          };
          merged.set(legacy.id, legacy);
        });
        for (const s of builtins) merged.set(s.id, s);
        for (const s of customs) merged.set(s.id, s);
        return Array.from(merged.values());
      }
    } catch { /* fallback to local */ }
  }

  for (const s of builtins) merged.set(s.id, s);
  for (const s of customs) merged.set(s.id, s);
  return Array.from(merged.values());
}

/** 查找技能（含自定义），异步版本 */
export async function findSkillAsync(id: string): Promise<WritingSkill | undefined> {
  const customs = await loadCustomSkills();
  return findSkill(id, customs);
}
