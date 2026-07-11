// PhaseConfigService — 阶段配置管理
// Skill 只含元数据，systemPrompt 等 AI 配置在此独立管理
// 允许同一提示词模板被多个 Skill 共享

export interface PhaseConfig {
  id: string;
  skillId?: string;         // 可选关联技能
  phase: string;            // "title" | "outline" | "writing" | ...
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

// ─── 内置默认配置（未来可迁移到 SQLite） ───

const BUILTIN_CONFIGS: Record<string, PhaseConfig> = {
  "outline": {
    id: "builtin-outline",
    phase: "outline",
    systemPrompt: `你是一位资深写作规划师。为文章设计逻辑递进、节奏张弛有度的大纲。

直接输出大纲内容，不要输出任何思考过程。

## 输出格式
使用 Markdown 标题格式，每条大纲必须包含**序号、标题和描述**：

## 1. 标题 —— 描述
### 1.1 子标题 —— 子标题描述
### 1.2 子标题 —— 子标题描述
## 2. 标题 —— 描述
### 2.1 子标题 —— 子标题描述

## 要求
- 一级章节必须用 ## 开头；二级子章节必须用 ### 开头
- 每个大纲项必须包含序号（1. 2. 3. 或 1.1 2.1 等），序号后跟标题
- 必须用中文破折号 —— 分隔标题和描述
- 至少 3-5 个一级章节，每个一级章节下至少 2-3 个子章节
- 每项描述必须给出（10-20 字），不能省略

## 叙事弧线
大纲必须有清晰的叙事推进：
1. 引入认知落差 —— 打破常规视角，激发阅读兴趣
2. 核心概念拆解 —— 分层解析、逻辑递进
3. 实操/案例 —— 可验证、可复用的方法论
4. 拔高/延展 —— 上升到更广的维度或哲学思考
5. 收束 —— 凝练主旨、留下余韵

## 输出语言
- 使用流畅自然的中文，禁止混用英文或其他语言。所有内容必须为中文。`,
    temperature: 0.7,
    maxTokens: 2048,
  },
  "writing": {
    id: "builtin-writing",
    phase: "writing",
    systemPrompt: `你是一位资深文章写作者。你的任务是为给定的项目写一篇高质量的技术文章。

直接输出文章正文，不要输出任何思考过程。

## 写作要求
- 使用流畅自然的中文
- 标题、正文、所有内容均必须为中文
- 结构清晰、逻辑递进`,
    temperature: 0.7,
    maxTokens: 4096,
  },
};

// ─── Service API ───

let customConfigs: Record<string, PhaseConfig> = {};

export class PhaseConfigService {
  static get(phaseId: string): PhaseConfig | undefined {
    return customConfigs[phaseId] || BUILTIN_CONFIGS[phaseId];
  }

  static getForSkill(skillId: string, phase: string): PhaseConfig | undefined {
    // Look for skill-specific config first, then generic
    return Object.values(customConfigs).find(
      (c) => c.skillId === skillId && c.phase === phase
    ) || customConfigs[`${skillId}:${phase}`] || BUILTIN_CONFIGS[phase];
  }

  static set(config: PhaseConfig): void {
    customConfigs[config.id] = config;
  }

  static delete(id: string): void {
    delete customConfigs[id];
  }

  /** Register multiple configs at once (for skill packages) */
  static register(configs: PhaseConfig[]): void {
    for (const c of configs) {
      customConfigs[c.id] = c;
    }
  }

  /** Get all registered configs (for export/sync) */
  static getAll(): PhaseConfig[] {
    return [...Object.values(BUILTIN_CONFIGS), ...Object.values(customConfigs)];
  }

  /** Reset to built-in only (for testing) */
  static reset(): void {
    customConfigs = {};
  }
}
