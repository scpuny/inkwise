// ─── SettingsStore 接口 ───
// 抽象设置/发布/提供商持久化操作
// 独立于 DocumentStore，关注应用配置而非用户文档

import type { Provider, ModelEntry, PlatformConfig, PublishOptions, PublishResult, PublishRecord } from "../domain";

export interface SettingsStore {
  // ── AI 提供商 ──
  getProvidersSync(): Provider[];
  saveProvidersSync(providers: Provider[]): void;
  getImageModelsSync(): ModelEntry[];

  // ── 发布平台 ──
  getPlatformConfigs(): Promise<PlatformConfig[]>;
  savePlatformConfig(config: PlatformConfig): Promise<void>;
  deletePlatformConfig(id: string): Promise<void>;
  verifyPlatformCredentials(platform: string, appId: string, appSecret: string): Promise<boolean>;

  // ── 发布记录 ──
  getPublishHistory(articleId: string): Promise<PublishRecord[]>;
  addPublishRecord(record: PublishRecord): Promise<void>;
  publishArticle(articleId: string, platform: string, markdown: string, styledHtml: string, options: PublishOptions, action: "draft" | "publish"): Promise<PublishResult>;
}
