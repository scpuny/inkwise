// ─── TauriSettingsStore — SettingsStore 桥接实现 ───
// 桥接到旧 storage/providerModels 和 storage/platforms 模块
// 后续可替换为 SQLite/Rust 后端实现

import type { Provider, ModelEntry, PlatformConfig, PublishOptions, PublishResult, PublishRecord } from "../domain";
import type { SettingsStore } from "./SettingsStore";
import {
  getProvidersSync as oldGetProvidersSync,
  saveProvidersSync as oldSaveProvidersSync,
  getImageModelsSync as oldGetImageModelsSync,
} from "../lib/storage/providerModels";
import {
  getPlatformConfigs as oldGetPlatformConfigs,
  savePlatformConfig as oldSavePlatformConfig,
  deletePlatformConfig as oldDeletePlatformConfig,
  verifyPlatformCredentials as oldVerifyPlatformCredentials,
  getPublishHistory as oldGetPublishHistory,
  addPublishRecord as oldAddPublishRecord,
  publishArticle as oldPublishArticle,
} from "../lib/storage/platforms";

export class TauriSettingsStore implements SettingsStore {
  // ── AI 提供商 ──
  getProvidersSync(): Provider[] {
    return oldGetProvidersSync();
  }

  saveProvidersSync(providers: Provider[]): void {
    oldSaveProvidersSync(providers);
  }

  getImageModelsSync(): ModelEntry[] {
    return oldGetImageModelsSync();
  }

  // ── 发布平台 ──
  async getPlatformConfigs(): Promise<PlatformConfig[]> {
    return oldGetPlatformConfigs();
  }

  async savePlatformConfig(config: PlatformConfig): Promise<void> {
    return oldSavePlatformConfig(config);
  }

  async deletePlatformConfig(id: string): Promise<void> {
    return oldDeletePlatformConfig(id);
  }

  async verifyPlatformCredentials(platform: string, appId: string, appSecret: string): Promise<boolean> {
    return oldVerifyPlatformCredentials(platform, appId, appSecret);
  }

  // ── 发布记录 ──
  async getPublishHistory(articleId: string): Promise<PublishRecord[]> {
    return oldGetPublishHistory(articleId);
  }

  async addPublishRecord(record: PublishRecord): Promise<void> {
    return oldAddPublishRecord(record);
  }

  async publishArticle(articleId: string, platform: string, markdown: string, styledHtml: string, options: PublishOptions, action: "draft" | "publish"): Promise<PublishResult> {
    return oldPublishArticle(articleId, platform, markdown, styledHtml, options, action);
  }
}
