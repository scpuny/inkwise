// domain/Publish.ts — 发布相关纯类型定义

/** 平台配置 */
export interface PlatformConfig {
  id: string;
  platform: string;
  label: string;
  appId: string;
  appSecret: string;
  accessToken?: string;
  tokenExpiresAt?: number;
  enabled: boolean;
}

/** 发布选项 */
export interface PublishOptions {
  title?: string;
  coverImage?: string;
  summary?: string;
  declareOriginal: boolean;
  allowReprint: boolean;
  chargeable: boolean;
  author?: string;
  contentSourceUrl?: string;
  picCrop2351?: string;
  picCrop11?: string;
  productKey?: string;
}

/** 发布结果 */
export interface PublishResult {
  success: boolean;
  platformArticleId?: string;
  platformUrl?: string;
  errorMessage?: string;
  isDraft: boolean;
}
