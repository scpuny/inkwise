/**
 * export/types.ts — 导出相关的类型定义
 */

/** 图片项：用于跟踪文章中需要上传的图片 */
export interface ImageItem {
  originalSrc: string;
  uploadedUrl?: string;
  alt: string;
  index: number;
}

/** 导出结果 */
export interface ExportResult {
  /** 导出的 HTML */
  html: string;
  /** 图片列表（供后续上传） */
  images: ImageItem[];
}
