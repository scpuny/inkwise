// Tauri bridge — detects Tauri and provides invoke wrapper.
// Falls back to a no-op when running in browser (dev mode).

/** 集中管理所有 Tauri 后端命令名，防止拼写错误 */
export enum TauriCommands {
  // ── Collections / Articles ──
  GetCollections = "get_collections",
  SetCollections = "set_collections",
  GetTrash = "get_trash",
  SetTrash = "set_trash",
  SaveArticle = "save_article",
  LoadArticle = "load_article",
  DeleteArticle = "delete_article",
  SaveArticleMeta = "save_article_meta",
  LoadArticleMeta = "load_article_meta",
  // ⚠️ DEPRECATED in v2.1.0 — use SaveArticleDocument / LoadArticleDocument
  SaveArticleBlueprint = "save_article_blueprint",
  LoadArticleBlueprint = "load_article_blueprint",

  // ── ArticleDocument (v2.1.0) ──
  SaveArticleDocument = "save_article_document",
  LoadArticleDocument = "load_article_document",
  CreateCollectionDb = "create_collection_db",
  DeleteArticleDb = "delete_article_db",
  DeleteCollectionDb = "delete_collection_db",
  DeleteCollectionCascade = "delete_collection_cascade",
  MoveArticleDb = "move_article_db",
  SearchArticleDb = "search_articles_db",

  // ── Vector Search ──
  VectorSearch = "vector_search",
  IndexArticleVector = "index_article_vector",
  DeleteArticleVector = "delete_article_vector",
  GetVectorStats = "get_vector_stats",
  IndexAllVectors = "index_all_vectors",
  RenameCollectionDb = "rename_collection_db",
  BuildFolderIndex = "build_folder_index",
  LinkCollectionFolder = "link_collection_folder",
  GetProjectContext = "get_project_context",
  GetProjectContextText = "get_project_context_text",
  RescanProjectFolder = "rescan_project_folder",
  RescanProjectFolderIncremental = "rescan_project_folder_incremental",
  SaveAllSeriesPlans = "save_all_series_plans",
  LoadAllSeriesPlans = "load_all_series_plans",
  LoadSeriesPlan = "load_series_plan",
  DeleteSeriesPlan = "delete_series_plan",
  ReadProjectFiles = "read_project_files",
  PickFolder = "pick_folder",
  StartWatchingProject = "start_watching_project",
  StopWatchingProject = "stop_watching_project",

  // ── Providers / Models ──
  GetProviders = "get_providers",
  SetProviders = "set_providers",
  FetchModels = "fetch_models",
  FetchModelsFromUrl = "fetch_models_from_url",
  GetAllModels = "get_all_models",

  // ── Skills ──
  ListWritingSkills = "list_writing_skills",
  SaveWritingSkill = "save_writing_skill",
  DeleteWritingSkill = "delete_writing_skill",
  ListCustomThemes = "list_custom_themes",
  SaveCustomThemes = "save_custom_themes",
  DeleteCustomTheme = "delete_custom_theme",
  ListSkills = "list_skills",
  ListUnifiedSkills = "list_unified_skills",  ReadSkill = "read_skill",
  DeleteSkill = "delete_skill",
  SetSkillEnabled = "set_skill_enabled",
  RunSkill = "run_skill",

  // ── Platform publish ──
  GetPlatformConfigs = "get_platform_configs",
  SavePlatformConfig = "save_platform_config",
  DeletePlatformConfig = "delete_platform_config",
  VerifyPlatformCredentials = "verify_platform_credentials",
  GetPublishHistory = "get_publish_history",
  SavePublishRecords = "save_publish_records",
  PublishToPlatform = "publish_to_platform",

  // ── AI / Chat ──
  ChatStream = "chat_stream",

  // ── Utilities ──
  GetSettings = "get_settings",
  SetSettings = "set_settings",
  GetStoragePath = "get_storage_path",
  ExportData = "export_data",
  ImportData = "import_data",
  CheckPublicIp = "check_public_ip",
  DialogOpen = "dialog_open",
  DialogSave = "dialog_save",
  FsWriteTextFile = "fs_write_text_file",
  ClipboardWriteHtml = "plugin:clipboard-manager|write_html",
  ClipboardWriteText = "plugin:clipboard-manager|write_text",
}

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

let _invoke: InvokeFn | null = null;

// Detect Tauri: __TAURI_INTERNALS__ is injected by Tauri's WebView
const isTauri: boolean =
  typeof window !== "undefined" &&
  typeof (window as any).__TAURI_INTERNALS__ !== "undefined";

// Try to load the invoke function
const initPromise: Promise<void> = (async () => {
  if (!isTauri) return;
  try {
    const mod = await import("@tauri-apps/api/core");
    _invoke = mod.invoke as InvokeFn;
  } catch {
    // Fallback: use window.__TAURI_INTERNALS__.invoke (for mock/testing)
    _invoke = (window as any).__TAURI_INTERNALS__?.invoke || null;
  }
})();

export function isTauriEnv(): boolean {
  return isTauri && _invoke !== null;
}

export async function waitForTauri(): Promise<void> {
  await initPromise;
}

/** 调用 Tauri 后端命令，非 Tauri 环境抛异常 */
export async function tryInvoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (!_invoke && isTauri) {
    await initPromise;
  }
  if (_invoke) {
    return (await _invoke(cmd, args)) as T;
  }
  throw new Error(`Tauri invoke not available for: ${cmd}`);
}

/** 安全调用 Tauri 后端命令，失败或非 Tauri 环境时执行 fallback */
export async function invokeOrFallback<T>(
  cmd: string,
  args: Record<string, unknown> | undefined,
  fallback: () => T,
): Promise<T> {
  if (!_invoke && isTauri) {
    await initPromise;
  }
  if (_invoke) {
    try {
      return (await _invoke(cmd, args)) as T;
    } catch (err) {
      console.error(`[invokeOrFallback] Tauri invoke "${cmd}" failed:`, err);
      return fallback();
    }
  }
  return fallback();
}
