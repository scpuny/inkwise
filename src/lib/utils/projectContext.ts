// projectContext.ts — 项目上下文桥接层
// 提供前端构建 AI prompt 时使用的项目上下文字符串生成

import {
  getProjectContext,
  getProjectContextText,
  type ProjectContext,
} from "../storage/collections";

/**
 * 构建 AI 可读的项目上下文文本。
 * 如果前端已有缓存的 ProjectContext，直接传进来用；
 * 否则通过 Tauri IPC 同步。
 */
export async function buildContextText(
  projectPath: string,
  existingCtx?: ProjectContext | null,
): Promise<string> {
  if (existingCtx) {
    return formatContextText(existingCtx);
  }
  if (projectPath) {
    try {
      return await getProjectContextText(projectPath);
    } catch {
      return "";
    }
  }
  return "";
}

/**
 * 将 ProjectContext 格式化为 AI 可读的文本。
 * 与 Rust 端 build_context_text 保持一致。
 */
export function formatContextText(ctx: ProjectContext): string {
  const parts: string[] = [];

  // 项目概况
  parts.push(
    [
      "## 项目概况",
      `- 名称: ${ctx.name}`,
      `- 语言: ${ctx.primaryLanguage || "未知"}`,
      `- 文件数: ${ctx.summary.totalFiles}, 目录数: ${ctx.summary.totalDirs}`,
      ctx.codegraphAvailable ? "- CodeGraph 索引: 可用" : "- CodeGraph 索引: 无",
    ].join("\n"),
  );

  // 语言分布
  if (ctx.summary.languages.length > 0) {
    parts.push("## 语言分布");
    for (const lang of ctx.summary.languages) {
      parts.push(`- ${lang.language}: ${lang.count} 文件`);
    }
  }

  // 配置文件
  for (const cfg of ctx.configs) {
    parts.push(`## 配置文件: ${cfg.name}\n\`\`\`\n${cfg.content}\n\`\`\``);
  }

  // 导出符号
  if (ctx.symbols.length > 0) {
    parts.push("## 导出符号");
    const byKind: Record<string, typeof ctx.symbols> = {};
    for (const sym of ctx.symbols) {
      (byKind[sym.kind] ??= []).push(sym);
    }
    for (const [kind, syms] of Object.entries(byKind)) {
      parts.push(`### ${kind} (${syms.length} 个)`);
      for (const s of syms.slice(0, 20)) {
        const sig = s.signature || s.name;
        parts.push(`- \`${sig}\` — ${s.filePath}`);
      }
      if (syms.length > 20) {
        parts.push(`  ... 还有 ${syms.length - 20} 个`);
      }
    }
  }

  // 模块依赖
  if (ctx.imports.length > 0) {
    parts.push("## 模块依赖关系");
    const sources: Record<string, Set<string>> = {};
    for (const imp of ctx.imports) {
      (sources[imp.source] ??= new Set()).add(imp.target);
    }
    for (const [src, targets] of Object.entries(sources)) {
      parts.push(`- \`${src}\` → ${targets.size} 个外部依赖`);
    }
  }

  return parts.join("\n\n");
}

/**
 * 从项目上下文提取"项目概览"简短文本，
 * 适合用在合集名称下方或写作界面标签。
 */
export function buildProjectLabel(ctx: ProjectContext): string {
  const lang = ctx.primaryLanguage || "";
  const files = `${ctx.summary.totalFiles} 文件`;
  return [ctx.name, lang, files].filter(Boolean).join(" · ");
}

/**
 * 判断两个路径是否能代表同一个项目（防止重复扫描）
 */
export function isSameProject(path1: string, path2: string): boolean {
  // 去掉尾部斜杠后比较
  const normalize = (p: string) => p.replace(/\/+$/, "");
  return normalize(path1) === normalize(path2);
}
