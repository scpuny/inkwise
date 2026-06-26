// storage.ts — 写作技能存储：CRUD 与工具函数
import { tryInvoke, TauriCommands } from "../../bridge/tauri";
import type { WritingSkill, SkillPhase, PhaseConfig } from "./types";
import { getBuiltinSkills, getAllBuiltinSkills } from "./builtins";
import { DEFAULT_PHASE_CONFIGS } from "./defaults";

/* ─── 工具函数 ─── */

/** 按 ID 查找技能（在 custom 列表中查找，fallback 到内置） */
export function findSkill(id: string, customs?: WritingSkill[]): WritingSkill | undefined {
  const all = [...(customs || []), ...getAllBuiltinSkills()];
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
    icon: "\u{1F4DD}",
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

const CUSTOM_SKILLS_KEY = "aiwriter-custom-skills";

/** 加载自定义技能 */
export async function loadCustomSkills(): Promise<WritingSkill[]> {
  try {
    return await tryInvoke<WritingSkill[]>(TauriCommands.ListWritingSkills);
  } catch { /* fallback */ }
  try {
    const raw = localStorage.getItem(CUSTOM_SKILLS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

/** 保存自定义技能 */
export async function saveCustomSkill(skill: WritingSkill): Promise<void> {
  skill.updatedAt = Date.now();
  try {
    await tryInvoke(TauriCommands.SaveWritingSkill, { skill });
    return;
  } catch { /* fallback */ }
  const skills = await loadCustomSkills();
  const idx = skills.findIndex((s) => s.id === skill.id);
  if (idx >= 0) skills[idx] = skill;
  else skills.push(skill);
  localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(skills));
}

/** 删除自定义技能 */
export async function deleteCustomSkill(id: string): Promise<void> {
  try {
    await tryInvoke(TauriCommands.DeleteWritingSkill, { id });
    return;
  } catch { /* fallback */ }
  const skills = await loadCustomSkills();
  localStorage.setItem(CUSTOM_SKILLS_KEY, JSON.stringify(skills.filter((s) => s.id !== id)));
}

/** 合并内置 + 自定义技能列表 */
export async function getAllSkills(): Promise<WritingSkill[]> {
  const customs = await loadCustomSkills();
  const builtins = getAllBuiltinSkills();
  const merged = new Map<string, WritingSkill>();
  for (const s of builtins) merged.set(s.id, s);
  for (const s of customs) merged.set(s.id, s);
  return Array.from(merged.values());
}

/** 查找技能（含自定义），异步版本 */
export async function findSkillAsync(id: string): Promise<WritingSkill | undefined> {
  const customs = await loadCustomSkills();
  return findSkill(id, customs);
}
