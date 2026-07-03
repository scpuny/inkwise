// articleBlueprint.ts — 文章蓝图：结构化元数据 + 大纲
// 存储：Tauri 后端 → {id}.blueprint.json | 浏览器 → localStorage

import { isTauriEnv, TauriCommands, tryInvoke } from "../bridge/tauri";

/* ─── 类型定义 ─── */

export type ArticlePhase = "planning" | "writing" | "reviewing" | "complete";
export type SectionStatus = "pending" | "writing" | "complete" | "revised";

export interface OutlineSection {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  description?: string;
  targetWordCount?: number;
  status: SectionStatus;
  notes?: string;
}

export interface ArticleBlueprint {
  workingTitle: string;
  description: string;
  targetWordCount?: number;
  tone?: string;
  targetAudience?: string;
  coverImage?: string;
  phase: ArticlePhase;
  tags: string[];
  outline: OutlineSection[];
  skillId?: string;
  /** 写作风格 ID（v2.0.0 新增，替代 skillId） */
  styleId?: string;
  /** 写作动作 ID（v2.0.0 新增） */
  actionId?: string;
  updatedAt: number;
}

/* ─── 默认蓝图 ─── */

export function createDefaultBlueprint(title: string): ArticleBlueprint {
  return {
    workingTitle: title,
    description: "",
    phase: "planning",
    tags: [],
    styleId: "general",
    outline: [
      { id: genOutlineId(), title: "引言", level: 1, status: "pending" },
      { id: genOutlineId(), title: "正文", level: 1, status: "pending" },
      { id: genOutlineId(), title: "结语", level: 1, status: "pending" },
    ],
    updatedAt: Date.now(),
  };
}

let _oid = 0;
function genOutlineId(): string {
  return `sec_${Date.now()}_${_oid++}`;
}

/* ─── 存储（Tauri + localStorage 双模式） ─── */

const STORAGE_PREFIX = "blueprint:";

export async function saveBlueprint(id: string, blueprint: ArticleBlueprint): Promise<void> {
  blueprint.updatedAt = Date.now();

  if (isTauriEnv()) {
    try {
      await tryInvoke(TauriCommands.SaveArticleBlueprint, { id, blueprint });
      return;
    } catch { /* fallback to localStorage */ }
  }

  // Browser / fallback
  try {
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(blueprint));
  } catch { /* ignore */ }
}

export async function loadBlueprint(id: string): Promise<ArticleBlueprint | null> {
  if (isTauriEnv()) {
    try {
      const result = await tryInvoke<ArticleBlueprint | null>(TauriCommands.LoadArticleBlueprint, { id });
      if (result) return result;
    } catch { /* fallback */ }
  }

  // Browser / fallback
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + id);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function deleteBlueprint(id: string): Promise<void> {
  if (isTauriEnv()) {
    try { await tryInvoke("delete_article", { id }); } catch {}
  }
  try {
    localStorage.removeItem(STORAGE_PREFIX + id);
  } catch { /* ignore */ }
}

/* ─── 辅助函数 ─── */

export function getPhaseLabel(phase: ArticlePhase): string {
  switch (phase) {
    case "planning": return "规划中";
    case "writing": return "写作中";
    case "reviewing": return "审校中";
    case "complete": return "已完成";
  }
}

export function getSectionStatusLabel(status: SectionStatus): string {
  switch (status) {
    case "pending": return "待写";
    case "writing": return "写作中";
    case "complete": return "已完成";
    case "revised": return "已修改";
  }
}

export function getPhaseNext(phase: ArticlePhase): ArticlePhase | null {
  switch (phase) {
    case "planning": return "writing";
    case "writing": return "reviewing";
    case "reviewing": return "complete";
    case "complete": return null;
  }
}

/** 根据当前大纲和各 section 状态计算写作进度百分比 */
export function computeWritingProgress(outline: OutlineSection[]): number {
  if (outline.length === 0) return 0;
  let total = 0;
  for (const s of outline) {
    switch (s.status) {
      case "complete": total += 100; break;
      case "revised": total += 100; break;
      case "writing": total += 50; break;
      case "pending": total += 0; break;
    }
  }
  return Math.round(total / outline.length);
}

/** 构建 AI 可读的蓝图上下文文本 */
export function buildBlueprintContext(
  blueprint: ArticleBlueprint,
  currentSectionId?: string,
): string {
  const lines: string[] = [];

  if (blueprint.workingTitle) lines.push(`## 文章标题\n${blueprint.workingTitle}`);
  if (blueprint.description) lines.push(`## 文章简介\n${blueprint.description}`);
  if (blueprint.tone) lines.push(`## 语气风格\n${blueprint.tone}`);
  if (blueprint.targetAudience) lines.push(`## 目标读者\n${blueprint.targetAudience}`);
  if (blueprint.targetWordCount) lines.push(`## 目标字数\n${blueprint.targetWordCount} 字`);

  if (blueprint.outline.length > 0) {
    lines.push(`## 文章大纲`);
    const currentSection = currentSectionId
      ? blueprint.outline.find((s) => s.id === currentSectionId)
      : null;

    blueprint.outline.forEach((s, i) => {
      const marker = s.id === currentSectionId ? " ← 当前位置" : "";
      const statusIcon = s.status === "complete" ? "✅" : s.status === "writing" ? "✍️" : s.status === "revised" ? "📝" : "⏳";
      const desc = s.description ? ` — ${s.description}` : "";
      lines.push(`  ${statusIcon} ${"  ".repeat(s.level - 1)}${i + 1}. ${s.title}${desc}${marker}`);
    });
  }

  return lines.join("\n");
}
