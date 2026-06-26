// projectContext.ts — 项目目录上下文扫描（Tauri IPC）
import { isTauriEnv, tryInvoke, invokeOrFallback, TauriCommands } from "../../bridge/tauri";
import type { ProjectContext, FileNode, FileContent } from "./types";

export async function linkCollectionFolder(collectionId: string, path: string): Promise<ProjectContext> {
  const ctx = await getProjectContext(path);
  const { loadCollections, saveCollections } = await import("./crud");
  const all = await loadCollections();
  const col = all.find((x) => x.id === collectionId);
  if (col) {
    col.linkedFolder = path;
    await saveCollections(all);
  }
  return ctx;
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
