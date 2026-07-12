// ─── useSettings — 设置/发布/提供商 Hook ───
// 通过 SettingsStore 接口访问，不依赖具体实现
// 目前桥接到旧 storage/providerModels 和 storage/platforms

import { useCallback } from "react";
import type { Provider, ModelEntry, PlatformConfig, PublishOptions, PublishResult, PublishRecord } from "../domain";
import { TauriSettingsStore } from "../infrastructure/TauriSettingsStore";

const DEFAULT_STORE = new TauriSettingsStore();

export function useSettings(store = DEFAULT_STORE) {
  // ── AI 提供商 ──
  const getProvidersSync = useCallback((): Provider[] => {
    return store.getProvidersSync();
  }, [store]);

  const saveProvidersSync = useCallback((providers: Provider[]) => {
    store.saveProvidersSync(providers);
  }, [store]);

  const getImageModelsSync = useCallback((): ModelEntry[] => {
    return store.getImageModelsSync();
  }, [store]);

  // ── 发布平台 ──
  const getPlatformConfigs = useCallback(async (): Promise<PlatformConfig[]> => {
    return store.getPlatformConfigs();
  }, [store]);

  const savePlatformConfig = useCallback(async (config: PlatformConfig) => {
    await store.savePlatformConfig(config);
  }, [store]);

  const deletePlatformConfig = useCallback(async (id: string) => {
    await store.deletePlatformConfig(id);
  }, [store]);

  const verifyPlatformCredentials = useCallback(async (platform: string, appId: string, appSecret: string): Promise<boolean> => {
    return store.verifyPlatformCredentials(platform, appId, appSecret);
  }, [store]);

  const getPublishHistory = useCallback(async (articleId: string): Promise<PublishRecord[]> => {
    return store.getPublishHistory(articleId);
  }, [store]);

  const addPublishRecord = useCallback(async (record: PublishRecord) => {
    await store.addPublishRecord(record);
  }, [store]);

  const publishArticle = useCallback(async (
    articleId: string,
    platform: string,
    markdown: string,
    styledHtml: string,
    options: PublishOptions,
    action: "draft" | "publish",
  ): Promise<PublishResult> => {
    return store.publishArticle(articleId, platform, markdown, styledHtml, options, action);
  }, [store]);

  return {
    getProvidersSync,
    saveProvidersSync,
    getImageModelsSync,
    getPlatformConfigs,
    savePlatformConfig,
    deletePlatformConfig,
    verifyPlatformCredentials,
    getPublishHistory,
    addPublishRecord,
    publishArticle,
  };
}
