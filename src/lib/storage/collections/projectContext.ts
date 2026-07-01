// projectContext.ts — 项目目录上下文扫描（Tauri IPC）
import { isTauriEnv, tryInvoke, invokeOrFallback, TauriCommands } from "../../bridge/tauri";
import type { ProjectContext, FileNode, FileContent } from "./types";

export async function linkCollectionFolder(collectionId: string, path: string): Promise<ProjectContext & { insights?: string }> {
  const ctx = await getProjectContext(path);
  const { loadCollections, saveCollections } = await import("./crud");
  const all = await loadCollections();
  const col = all.find((x) => x.id === collectionId);
  if (col) {
    col.linkedFolder = path;
    await saveCollections(all);
  }
  // Cache file tree for ProjectExplorer (fast display)
  if (ctx.structure && ctx.structure.length > 0) {
    storeProjectFileTree(collectionId, ctx.structure);
  }
  // Kick off AI-powered exploration in background (don't block linking)
  exploreProjectForCollection(collectionId, path);
  return ctx;
}

const _exploringSet = new Set<string>();

export async function exploreProjectForCollection(collectionId: string, path: string, signal?: AbortSignal): Promise<void> {
  if (_exploringSet.has(collectionId)) return;
  if (signal?.aborted) return;
  _exploringSet.add(collectionId);
  const { emit } = await import("../../events/eventBus");
  const { sendChat } = await import("../../ai/ai");
  const { getProvidersSync } = await import("../../storage/providerModels");
  const { resolveModel } = await import("../../config/globalAIConfig");
  try {
    emit("project-exploring" as any, { collectionId, status: "start" });
    emit("project-exploring" as any, { collectionId, status: "progress", toolEvent: { type: "thinking", toolName: "", toolCallId: "think_0", arguments: "", summary: "\u{1F50D} 正在读取项目目录\u2026" } });

    // 1. Get project context from Rust (fast)
    const ctx = await getProjectContext(path);
    if (signal?.aborted) throw new Error("\u626B\u63CF\u5DF2\u53D6\u6D88");

    // 2. Identify key files
    const keyFiles = identifyKeyFiles(ctx);
    emit("project-exploring" as any, { collectionId, status: "progress", toolEvent: { type: "thinking", arguments: "\u627E\u5230 " + keyFiles.length + " \u4E2A\u5173\u952E\u6587\u4EF6", summary: "\u627E\u5230 " + keyFiles.length + " \u4E2A\u5173\u952E\u6587\u4EF6", toolName: "", toolCallId: "think_1" } });

    // 3. Read key files in batch
    emit("project-exploring" as any, { collectionId, status: "progress", toolEvent: { type: "tool_start", toolName: "read_project_files", toolCallId: "preload", arguments: JSON.stringify({ paths: keyFiles }), summary: "\u9884\u8BFB\u53D6 " + keyFiles.length + " \u4E2A\u5173\u952E\u6587\u4EF6" } });
    const fileContents = keyFiles.length > 0 ? await readProjectFiles(path, keyFiles) : [];
    if (signal?.aborted) throw new Error("\u626B\u63CF\u5DF2\u53D6\u6D88");
    emit("project-exploring" as any, { collectionId, status: "progress", toolEvent: { type: "tool_end", toolName: "read_project_files", toolCallId: "preload", arguments: "", summary: "\u8BFB\u53D6\u5B8C\u6210: " + fileContents.length + " \u4E2A\u6587\u4EF6", result: "" } });

    // 4. Build comprehensive prompt with all data
    emit("project-exploring" as any, { collectionId, status: "progress", toolEvent: { type: "thinking", toolName: "", toolCallId: "think_2", arguments: "\u6B63\u5728\u5206\u6790\u9879\u76EE\u67B6\u6784\u2026", summary: "\u6B63\u5728\u5206\u6790\u9879\u76EE\u67B6\u6784\u2026" } });
    const contextStr = buildProjectContextPrompt(ctx, fileContents);

    // 5. Single AI call (no tools, one round only!)
    const providers = getProvidersSync();
    const provider = providers.find(function(p: any) { return p.enabled && p.models && p.models.length > 0; });
    if (!provider) throw new Error("\u8BF7\u5148\u5728\u8BBE\u7F6E\u4E2D\u914D\u7F6E AI \u63D0\u4F9B\u5546");
    const model: string = resolveModel() || provider.models[0]?.id || "";
    const providerId: string = provider.id;

    const result = await sendChat({
      providerId,
      model,
      messages: [
        { role: "system", content:
          "\u4F60\u662F\u4E00\u4E2A\u8D44\u6DF1\u9879\u76EE\u67B6\u6784\u5206\u6790\u5E08\u3002\u6839\u636E\u63D0\u4F9B\u7684\u9879\u76EE\u76EE\u5F55\u7ED3\u6784\u3001\u914D\u7F6E\u6587\u4EF6\u548C\u5173\u952E\u6E90\u7801\uFF0C\u7ED9\u51FA\u7CBE\u70BC\u3001\u7ED3\u6784\u5316\u7684\u9879\u76EE\u5206\u6790\u62A5\u544A\u3002\u8981\u6C42\uFF1A\n" +
          "1. \u6280\u672F\u6808\uFF08\u8BED\u8A00\u3001\u6846\u67B6\u3001\u6784\u5EFA\u5DE5\u5177\u3001\u6570\u636E\u5E93\u7B49\uFF09\n" +
          "2. \u9879\u76EE\u67B6\u6784\uFF08\u6574\u4F53\u67B6\u6784\u98CE\u683C\u3001\u6A21\u5757\u5212\u5206\u3001\u6838\u5FC3\u8BBE\u8BA1\u6A21\u5F0F\uFF09\n" +
          "3. \u5173\u952E\u6A21\u5757\u8BF4\u660E\uFF08\u5404\u76EE\u5F55/%E6%A8%A1%E5%9D%97%E7%9A%84%E8%81%8C%E8%B4%A3%EF%BC%89\n" +
          "4. \u5173\u952E\u6587\u4EF6\u8BE6\u89E3\uFF08\u5165\u53E3\u6587\u4EF6\u3001\u6838\u5FC3\u903B\u8F91\u6587\u4EF6\u7684\u4F5C\u7528\uFF09\n" +
          "5. \u6784\u5EFA\u4E0E\u8FD0\u884C\u65B9\u5F0F\n\n" +
          "\u7528\u7B80\u6D01\u7684\u5206\u70B9\u683C\u5F0F\u8F93\u51FA\uFF0C\u6BCF\u4E2A\u70B9 1-3 \u884C\uFF0C\u4F18\u5148\u4F7F\u7528\u4E2D\u6587\u3002\u4E0D\u8981\u6709\u5BA2\u5957\u8BDD\u548C\u7075\u9B42\u9E21\u6C64\u3002"
        },
        { role: "user", content: "\u4EE5\u4E0B\u662F\u6211\u7684\u9879\u76EE\u5B8C\u6574\u4E0A\u4E0B\u6587\uFF0C\u8BF7\u5168\u9762\u5206\u6790\uFF1A\n\n" + contextStr },
      ],
      temperature: 0.3,
      maxTokens: 4096,
    });

    if (signal?.aborted) throw new Error("\u626B\u63CF\u5DF2\u53D6\u6D88");

    if (result) {
      storeProjectInsights(collectionId, result);
    }
    emit("project-exploring" as any, { collectionId, status: "done" });
  } catch (e: any) {
    if (e.message === "\u626B\u63CF\u5DF2\u53D6\u6D88") {
      emit("project-exploring" as any, { collectionId, status: "done" });
    } else {
      console.warn("[exploreProjectForCollection] Failed:", e);
      emit("project-exploring" as any, { collectionId, status: "error", message: e.message });
    }
  } finally {
    _exploringSet.delete(collectionId);
  }
}

/** Identify key files from project context for batch reading */
function identifyKeyFiles(ctx: any): string[] {
  const files: any[] = ctx.files || [];
  const configFiles: any[] = ctx.configFiles || ctx.configs || [];
  const candidates: string[] = [];

  // Config/build files (by name matching)
  const configNames = ["package.json", "Cargo.toml", "pyproject.toml", "go.mod", "tsconfig.json", "composer.json", "Gemfile", "build.gradle", "pom.xml", "Makefile", "Cargo.lock", "package-lock.json"];
  for (const name of configNames) {
    if (files.some((f: any) => f.path && f.path === name)) {
      candidates.push(name);
    }
  }

  // Config files from Rust scan
  for (const cf of configFiles) {
    const fpath = cf.path || cf.name;
    if (fpath && !candidates.includes(fpath)) candidates.push(fpath);
  }

  // README files
  for (const f of files) {
    if (f.name && /^README/i.test(f.name) && f.path) candidates.push(f.path);
  }

  // Entry point files
  const entryNames = ["src/main.tsx", "src/main.ts", "src/main.rs", "src/lib.rs", "src/App.tsx", "src/App.ts", "src/index.ts", "src/index.tsx", "src/index.js", "src/index.jsx", "main.rs", "lib.rs", "src/main.js", "src/main.jsx"];
  for (const name of entryNames) {
    if (files.some((f: any) => f.path === name) && !candidates.includes(name)) {
      candidates.push(name);
    }
  }

  // Top 5 largest source files (skip node_modules/.git/target/dist/build)
  const srcFiles = files
    .filter((f: any) => f.path && !f.isDir && !candidates.includes(f.path) && !/^(node_modules|\.git|target|dist|build|vendor)/.test(f.path))
    .sort((a: any, b: any) => (b.lines || 0) - (a.lines || 0))
    .slice(0, 5);
  for (const f of srcFiles) {
    if (!candidates.includes(f.path)) candidates.push(f.path);
  }

  return [...new Set(candidates)].filter(Boolean).slice(0, 15);
}

/** Build a comprehensive project context string for the AI prompt */
function buildProjectContextPrompt(ctx: any, fileContents: any[]): string {
  const parts: string[] = [];

  // Project summary
  parts.push("## \u9879\u76EE\u57FA\u672C\u4FE1\u606F");
  parts.push("- \u540D\u79F0: " + (ctx.name || ""));
  parts.push("- \u8DDF\u8DEF\u5F84: " + (ctx.rootPath || ""));
  parts.push("- \u4E3B\u8BED\u8A00: " + (ctx.primaryLanguage || "\u672A\u77E5"));
  parts.push("- \u6587\u4EF6\u6570: " + (ctx.summary?.totalFiles || 0) + ", \u76EE\u5F55\u6570: " + (ctx.summary?.totalDirs || 0) + ", \u4EE3\u7801\u884C\u6570: " + (ctx.summary?.totalLines || 0));
  parts.push("");

  // Languages
  const langs = ctx.summary?.languages || [];
  if (langs.length > 0) {
    parts.push("## \u8BED\u8A00\u5206\u5E03");
    for (const lang of langs) {
      parts.push("- " + (lang.language || lang.name || "\u672A\u77E5") + ": " + (lang.files || lang.count || 0) + " files" + (lang.lines ? ", " + lang.lines + " lines" : ""));
    }
    parts.push("");
  }

  // Top files by line count
  const topFiles = ctx.summary?.topFiles || [];
  if (topFiles.length > 0) {
    parts.push("## \u6700\u5927\u6E90\u6587\u4EF6");
    for (const f of topFiles.slice(0, 10)) {
      parts.push("- " + f.path + " (" + f.lines + " lines, " + (f.language || "\u672A\u77E5") + ")");
    }
    parts.push("");
  }

  // Directory tree (max depth 4)
  if (ctx.structure && ctx.structure.length > 0) {
    parts.push("## \u76EE\u5F55\u7ED3\u6784");
    parts.push(flattenTree(ctx.structure, 4));
    parts.push("");
  }

  // Key file contents
  if (fileContents.length > 0) {
    parts.push("## \u5173\u952E\u6587\u4EF6\u5185\u5BB9");
    for (const fc of fileContents) {
      if (fc.content && !fc.error) {
        const allLines = fc.content.split("\n");
        const truncated = allLines.length > 200
          ? allLines.slice(0, 200).join("\n") + "\n... (file truncated at 200 lines)"
          : fc.content;
        parts.push("### " + fc.path);
        parts.push("```" + (fc.language || ""));
        parts.push(truncated);
        parts.push("```");
        parts.push("");
      }
    }
  }

  return parts.join("\n");
}

function flattenTree(nodes: any[], maxDepth: number, depth: number = 0): string {
  let result = "";
  for (const n of nodes) {
    const indent = "  ".repeat(depth);
    if (n.isDir) {
      result += indent + "\uD83D\uDCC1 " + n.name + "/\n";
      if (n.children && depth < maxDepth) result += flattenTree(n.children, maxDepth, depth + 1);
    } else {
      result += indent + "\uD83D\uDCC4 " + n.name + "\n";
    }
  }
  return result;
}


export async function getProjectContext(path: string): Promise<ProjectContext> {
  const fallback: ProjectContext = {
    name: path.split("/").pop() || "project",
    rootPath: path,
    primaryLanguage: null,
    files: [],
    structure: [],
    codegraphAvailable: false,
    configs: [],
    symbols: [],
    imports: [],
    summary: { totalFiles: 0, totalDirs: 0, totalLines: 0, languages: [], topFiles: [] },
    configFiles: [],
  };
  try {
    return await invokeOrFallback<ProjectContext>(
      TauriCommands.GetProjectContext, { path },
      () => fallback,
    );
  } catch { return fallback; }
}

export async function getProjectContextText(path: string): Promise<string> {
  try {
    return await invokeOrFallback<string>(
      TauriCommands.GetProjectContext, { path, format: "text" },
      () => "",
    );
  } catch { return ""; }
}

export async function rescanProjectFolder(path: string): Promise<ProjectContext> {
  try {
    return await invokeOrFallback<ProjectContext>(
      TauriCommands.RescanProjectFolder, { path },
      () => ({
        name: "", rootPath: path, primaryLanguage: null, files: [], structure: [],
        codegraphAvailable: false,
    configs: [],
    symbols: [],
    imports: [],
        summary: { totalFiles: 0, totalDirs: 0, totalLines: 0, languages: [], topFiles: [] }, configFiles: [],
      }),
    );
  } catch {
    return { name: "", rootPath: path, primaryLanguage: null, files: [], structure: [],
      codegraphAvailable: false,
    configs: [],
    symbols: [],
    imports: [],
      summary: { totalFiles: 0, totalDirs: 0, totalLines: 0, languages: [], topFiles: [] }, configFiles: [] };
  }
}

export async function readProjectFiles(path: string, files: string[]): Promise<FileContent[]> {
  if (!isTauriEnv() || files.length === 0) return [];
  try {
    return await tryInvoke<FileContent[]>(TauriCommands.ReadProjectFiles, { path, files });
  } catch { return []; }
}

/** 在项目目录中查找与查询相关的文件（原签名兼容） */
export async function findAndReadRelevantFiles(
  keywords: string[],
  tree: FileNode[],
  projectPath: string,
  maxFiles: number = 6,
): Promise<{ matchedFiles: string[]; sourceCode: string }> {
  if (!keywords.length || !tree.length) return { matchedFiles: [], sourceCode: '' };

  const allFiles: { path: string; name: string; score: number }[] = [];
  function walk(nodes: FileNode[], dirPath: string = '') {
    for (const node of nodes) {
      if (node.isDir) {
        walk(node.children || [], dirPath + node.name + '/');
      } else {
        const lower = node.name.toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (lower.includes(kw.toLowerCase())) score += 10;
          if (/\.(java|kt|ts|js|py|go|rs|yml|yaml|xml|properties|conf)$/i.test(node.name)) {
            if (lower.includes(kw.toLowerCase())) score += 5;
          }
        }
        if (score > 0) allFiles.push({ path: dirPath + node.name, name: node.name, score });
      }
    }
  }
  walk(tree);

  allFiles.sort((a, b) => b.score - a.score);
  const selected = allFiles.slice(0, maxFiles);
  if (selected.length === 0) return { matchedFiles: [], sourceCode: '' };

  const filePaths = selected.map(f => f.path);
  const contents = await readProjectFiles(projectPath, filePaths);

  let sourceCode = '';
  for (const file of contents) {
    if (file.content && !file.error) {
      sourceCode += `\n### ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n`;
    }
  }

  return { matchedFiles: filePaths, sourceCode };
}

// ─── Project insights cache (AI-powered exploration results, stored per-collection) ───

const INSIGHTS_PREFIX = "inkwise-project-insights-";
const FILE_TREE_PREFIX = "inkwise-project-file-tree-";

export function getStoredProjectInsights(collectionId: string): string | null {
  try { return localStorage.getItem(INSIGHTS_PREFIX + collectionId); } catch { return null; }
}

export function storeProjectInsights(collectionId: string, insights: string): void {
  try { localStorage.setItem(INSIGHTS_PREFIX + collectionId, insights); } catch {}
}

export function storeProjectFileTree(collectionId: string, structure: any[]): void {
  try { localStorage.setItem(FILE_TREE_PREFIX + collectionId, JSON.stringify(structure)); } catch {}
}

export function getStoredProjectFileTree(collectionId: string): any[] | null {
  try {
    const raw = localStorage.getItem(FILE_TREE_PREFIX + collectionId);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function clearProjectFileTree(collectionId: string): void {
  try { localStorage.removeItem(FILE_TREE_PREFIX + collectionId); } catch {}
}

export function clearProjectInsights(collectionId: string): void {
  try { localStorage.removeItem(INSIGHTS_PREFIX + collectionId); } catch {}
}
