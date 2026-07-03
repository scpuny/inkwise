
// ─── 配图生成缓存（基于内容哈希） ───

const IMAGE_CACHE_KEY = 'inkwise-image-cache';

interface ImageCacheEntry {
  contentHash: string;
  timestamp: number;
  images: { path: string; sectionTitle?: string; altText: string }[];
}

function hashContent(content: string, config: { model: string; style: string; size: string; count: number }): string {
  let hash = 0;
  const str = content.slice(0, 2000) + JSON.stringify(config);
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return 'img_' + Math.abs(hash).toString(36);
}

function loadImageCache(): Record<string, ImageCacheEntry> {
  try {
    const raw = localStorage.getItem(IMAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveImageCache(cache: Record<string, ImageCacheEntry>): void {
  try {
    // Keep only last 50 entries to avoid bloating localStorage
    const entries = Object.entries(cache);
    if (entries.length > 50) {
      entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
      const trimmed = Object.fromEntries(entries.slice(0, 50));
      localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(cache));
    }
  } catch {}
}

/** 检查是否有缓存的配图 */
export function getCachedImages(content: string, config: { model: string; style: string; size: string; count: number }): { path: string; sectionTitle?: string; altText: string }[] | null {
  const hash = hashContent(content, config);
  const cache = loadImageCache();
  const entry = cache[hash];
  if (entry && Date.now() - entry.timestamp < 24 * 60 * 60 * 1000) { // 24h TTL
    return entry.images;
  }
  return null;
}

/** 缓存配图结果 */
export function cacheImages(content: string, config: { model: string; style: string; size: string; count: number }, images: { path: string; sectionTitle?: string; altText: string }[]): void {
  const hash = hashContent(content, config);
  const cache = loadImageCache();
  cache[hash] = { contentHash: hash, timestamp: Date.now(), images };
  saveImageCache(cache);
}

// draw.ts — 插图自动配图业务逻辑
// 关键词提取（LLM）+ 图片插入文章

import { sendChatStream, type ChatMessage } from "./ai";
import { resolveModel } from "../config/globalAIConfig";
import { getProvidersSync } from "../storage/providerModels";

const IMAGE_EXTRACT_PROMPT = `你是一个配图策划助手。根据下面这篇文章，提取绘画关键词。

要求：
1. 提取 {{count}} 组关键词，分别适配文章的不同章节
2. 每组包含：
   - section_title: 对应文章中的章节标题（必须与原文完全一致）
   - keywords: 英文绘图关键词，描述画面构图、主体、环境、色调、风格
   - alt_text: 中文简洁描述（用于图片 alt）
3. 按文章出现顺序排列
4. 只输出 JSON 数组，不要多余文字

输出格式：
[
  {"section_title": "引言", "keywords": "...", "alt_text": "..."},
  {"section_title": "核心分析", "keywords": "...", "alt_text": "..."}
]`;

/**
 * 调用 LLM 提取配图关键词
 */
export async function extractImageKeywords(
  articleContent: string,
  count: number,
): Promise<{ section_title: string; keywords: string; alt_text: string }[]> {
  const providers = getProvidersSync();
  const provider = providers.find(p => p.enabled && p.models.length > 0) || null;
  if (!provider) throw new Error("请先配置 AI 提供商");

  const prompt = IMAGE_EXTRACT_PROMPT.replace("{{count}}", String(count));
  const messages: ChatMessage[] = [
    { role: "system", content: prompt },
    { role: "user", content: articleContent.slice(0, 8000) },
  ];

  try {
    const text = await sendChatStream({
      providerId: provider.id,
      model: resolveModel() || provider.models[0].id,
      messages,
      temperature: 0.3,
      maxTokens: 2000,
    });
    return JSON.parse(extractJson(text));
  } catch {
    // 提取失败时返回空，跳过配图
    return [];
  }
}

/**
 * 将图片插入文章对应章节
 */
/**
 * 移除标题开头的序号（如 "2.1", "第3章", "一、" 等）
 */
function stripHeadingNumber(text: string): string {
  return text.replace(/^(?:\d+(?:\.\d+)*|第[一二三四五六七八九十百千]+[章节部篇]|[一二三四五六七八九十]+[.、．])\s*/, "").trim();
}

/**
 * 将图片插入文章对应章节
 * 匹配策略：
 *   1. 精确匹配（原文中有完全一致的标题）
 *   2. 去除序号后匹配（标题中的 "2.1 核心分析" ≈ "核心分析"）
 *   3. 标题包含关系（一方包含另一方）
 *   4. 兜底：插入文末
 */
export function insertImagesIntoArticle(
  markdown: string,
  images: { path: string; altText: string; targetSectionTitle?: string }[],
): string {
  let result = markdown;
  for (const img of images) {
    if (img.targetSectionTitle) {
      // Collect all heading lines with their content (skip fenced code blocks like ```mermaid)
      const headingRegex = /^(#{1,6})\s+(.+)$/gm;
      // Track fenced code block openings/closings to skip headings inside them
      const codeFenceRegex = /^```/gm;
      const codeFencePositions: number[] = [];
      let cfMatch: RegExpExecArray | null;
      while ((cfMatch = codeFenceRegex.exec(result)) !== null) {
        codeFencePositions.push(cfMatch.index);
      }
      const headings: { level: string; text: string; full: string; index: number }[] = [];
      let hMatch: RegExpExecArray | null;
      while ((hMatch = headingRegex.exec(result)) !== null) {
        const m = hMatch; // narrow type: RegExpExecArray (not null)
        // Check if this heading is inside a fenced code block
        const fencesBefore = codeFencePositions.filter(p => p < m.index).length;
        const insideCodeBlock = fencesBefore % 2 === 1;
        if (!insideCodeBlock) {
          headings.push({
            level: m[1],
            text: m[2].trim(),
            full: hMatch[0],
            index: hMatch.index,
          });
        }
      }

      const target = img.targetSectionTitle.trim();
      const targetStripped = stripHeadingNumber(target).toLowerCase();

      // Find best matching heading
      let bestMatch: typeof headings[0] | null = null;
      let bestScore = -1;

      for (const h of headings) {
        const hText = h.text;
        const hStripped = stripHeadingNumber(hText).toLowerCase();

        // Score: exact match = 3, stripped match = 2, contains = 1
        if (hText === target) {
          bestScore = 3;
          bestMatch = h;
          break; // Exact match is best, stop searching
        }
        if (hStripped === targetStripped && bestScore < 2) {
          bestScore = 2;
          bestMatch = h;
        }
        if ((hText.toLowerCase().includes(targetStripped) || targetStripped.includes(hText.toLowerCase())) && bestScore < 1) {
          bestScore = 1;
          bestMatch = h;
        }
      }

      if (bestMatch) {
        const imgMarkdown = `\n\n![${img.altText}](${img.path})\n`;
        // Insert after the heading line
        const insertPos = result.indexOf(bestMatch.full) + bestMatch.full.length;
        result = result.slice(0, insertPos) + imgMarkdown + result.slice(insertPos);
        continue;
      }
    }
    // 兜底：插入文末
    result = result + `\n\n![${img.altText}](${img.path})\n`;
  }
  return result;
}


/** 从 LLM 响应中提取 JSON 数组 */
function extractJson(text: string): string {
  const match = text.match(/\[[\s\S]*\]/);
  return match ? match[0] : "[]";
}
