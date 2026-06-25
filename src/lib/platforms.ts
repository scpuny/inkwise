import { isTauriEnv, invokeOrFallback } from "./tauri";

// ─── Types ───

export interface PlatformConfig {
  id: string;
  platform: string;       // "wechat" | "toutiao"
  label: string;
  appId: string;
  appSecret: string;
  accessToken?: string;
  tokenExpiresAt?: number;
  enabled: boolean;
}

export interface PublishRecord {
  id: string;
  articleId: string;
  platform: string;
  platformArticleId?: string;
  status: "draft" | "published" | "failed";
  errorMessage?: string;
  publishedAt: number;
  platformUrl?: string;
}

export interface PublishOptions {
  title?: string;
  coverImage?: string;
  summary?: string;
  declareOriginal: boolean;
  allowReprint: boolean;
  chargeable: boolean;
  author?: string;
}

export interface PublishResult {
  success: boolean;
  platformArticleId?: string;
  platformUrl?: string;
  errorMessage?: string;
  isDraft: boolean;
}

// ─── Platform Config CRUD ───

let nextPlatformId = Date.now();

function genPlatformId(): string {
  return `plat_${(nextPlatformId++).toString(36)}`;
}

const PLATFORM_CONFIGS_KEY = "aiwriter-platform-configs";

function loadPlatformConfigsLocal(): PlatformConfig[] {
  try {
    const raw = localStorage.getItem(PLATFORM_CONFIGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePlatformConfigsLocal(configs: PlatformConfig[]): void {
  try {
    localStorage.setItem(PLATFORM_CONFIGS_KEY, JSON.stringify(configs));
  } catch { /* ignore */ }
}

export async function getPlatformConfigs(): Promise<PlatformConfig[]> {
  if (isTauriEnv()) {
    try {
      return await invokeOrFallback<PlatformConfig[]>("get_platform_configs", {}, () => loadPlatformConfigsLocal());
    } catch { /* fallback */ }
  }
  return loadPlatformConfigsLocal();
}

export async function savePlatformConfig(config: PlatformConfig): Promise<void> {
  if (isTauriEnv()) {
    try {
      await invokeOrFallback("save_platform_config", { config }, () => {});
      return;
    } catch { /* fallback */ }
  }
  const configs = loadPlatformConfigsLocal();
  const idx = configs.findIndex((c) => c.id === config.id);
  if (idx >= 0) {
    configs[idx] = config;
  } else {
    config.id = genPlatformId();
    configs.push(config);
  }
  savePlatformConfigsLocal(configs);
}

export async function deletePlatformConfig(id: string): Promise<void> {
  if (isTauriEnv()) {
    try {
      await invokeOrFallback("delete_platform_config", { id }, () => {});
      return;
    } catch { /* fallback */ }
  }
  const configs = loadPlatformConfigsLocal();
  const filtered = configs.filter((c) => c.id !== id);
  savePlatformConfigsLocal(filtered);
}

export async function verifyPlatformCredentials(platform: string, appId: string, appSecret: string): Promise<boolean> {
  if (isTauriEnv()) {
    try {
      return await invokeOrFallback<boolean>("verify_platform_credentials", { platform, appId, appSecret }, () => false);
    } catch { /* fallback */ }
  }
  // Browser fallback: just validate that values are non-empty
  return !!(appId && appSecret);
}

// ─── Publish History ───

const PUBLISH_HISTORY_KEY = "aiwriter-publish-history";

function loadPublishHistoryLocal(): PublishRecord[] {
  try {
    const raw = localStorage.getItem(PUBLISH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePublishHistoryLocal(records: PublishRecord[]): void {
  try {
    localStorage.setItem(PUBLISH_HISTORY_KEY, JSON.stringify(records));
  } catch { /* ignore */ }
}

export async function getPublishHistory(articleId: string): Promise<PublishRecord[]> {
  if (isTauriEnv()) {
    try {
      return await invokeOrFallback<PublishRecord[]>("get_publish_history", { articleId }, () => []);
    } catch { /* fallback */ }
  }
  return loadPublishHistoryLocal().filter((r) => r.articleId === articleId);
}

export async function addPublishRecord(record: PublishRecord): Promise<void> {
  if (isTauriEnv()) {
    try {
      const records = await invokeOrFallback<PublishRecord[]>("get_publish_history", { articleId: record.articleId }, () => []);
      records.push(record);
      await invokeOrFallback("save_publish_records", { records }, () => {});
      return;
    } catch { /* fallback */ }
  }
  const records = loadPublishHistoryLocal();
  records.push(record);
  savePublishHistoryLocal(records);
}


// ─── Publish ───

export async function publishArticle(
  articleId: string,
  platform: string,
  markdown: string,
  styledHtml: string,
  options: PublishOptions,
  action: "draft" | "publish"
): Promise<PublishResult> {
  if (isTauriEnv()) {
    try {
      return await invokeOrFallback<PublishResult>(
        "publish_to_platform",
        { articleId, platform, markdown, styledHtml, options, action },
        () => ({ success: false, errorMessage: "Tauri 调用失败", isDraft: false })
      );
    } catch (e: any) {
      return { success: false, errorMessage: e?.message || "发布失败", isDraft: false };
    }
  }
  // Browser fallback - show mock success
  console.log("Browser mode: mock publish", { articleId, platform, action });
  // Log the styled HTML for debugging
  console.log("Styled HTML length:", styledHtml.length);
  return {
    success: true,
    platformArticleId: "mock_" + Date.now(),
    isDraft: action === "draft",
  };
}
