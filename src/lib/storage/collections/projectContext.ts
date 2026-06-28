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

export async function exploreProjectForCollection(collectionId: string, path: string): Promise<void> {
  if (_exploringSet.has(collectionId)) return;
  _exploringSet.add(collectionId);
  const { emit } = await import("../../events/eventBus");
  try {
    emit("project-exploring" as any, { collectionId, status: "start" });
    const { runAgentLoop, PROJECT_TOOLS } = await import("../../ai/agentEngine");
    const result = await runAgentLoop({
      systemPrompt: "你是一个项目结构分析助手。返回项目技术栈、模块划分、核心架构的简要总结（200字以内）。",
      userMessage: "请探索这个项目的目录结构，列出根目录和主要子目录的文件，识别技术栈。给出简洁总结。",
      tools: PROJECT_TOOLS,
      toolContext: { projectPath: path },
      maxToolRounds: 4,
      requestTimeoutMs: 60000,
      onToolEvent: function(ev: any) {
        // Forward tool events as exploration progress
        emit("project-exploring" as any, {
          collectionId,
          status: "progress",
          toolEvent: ev,
        });
      },
    });
    if (result.content) {
      storeProjectInsights(collectionId, result.content);
    }
    emit("project-exploring" as any, { collectionId, status: "done" });
  } catch (e: any) {
    console.warn("[exploreProjectForCollection] Failed:", e);
    emit("project-exploring" as any, { collectionId, status: "error", message: e.message });
  } finally {
    _exploringSet.delete(collectionId);
  }
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
