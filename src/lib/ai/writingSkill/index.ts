// index.ts [DEPRECATED] — 旧版写作技能模块统一导出
// @deprecated 向后兼容导出。新代码请直接引用 ../skillTypes.ts / ../unifiedSkills.ts。将在 v2.0.0 后移除。
export type {
  SkillScope, SkillPhase, ContextSource, PhaseConfig,
  ToolDeclaration, StyleDimension, WritingSkill,
} from "./types";

export {
  DEFAULT_TITLE_PROMPT, DEFAULT_DESCRIPTION_PROMPT,
  DEFAULT_OUTLINE_PROMPT, DEFAULT_TAGS_PROMPT, DEFAULT_WRITING_PROMPT,
  DEFAULT_PHASE_CONFIGS,
} from "./defaults";

export { getBuiltinSkills, getAllBuiltinSkills } from "./builtins";

export {
  findSkill, getDefaultSkill, getEffectivePhaseConfig,
  getSkillPhases, generateSkillId, createEmptySkill,
  loadCustomSkills, saveCustomSkill, deleteCustomSkill,
  getAllSkills, findSkillAsync,
} from "./storage";
