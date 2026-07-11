// ─── 合集/系列领域类型 ───
// 纯数据定义，不含业务逻辑

export interface Article {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  pinned?: boolean;
  description?: string;
  tags?: string[];
  phase?: string;
  blueprint?: string;
}

export interface Collection {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  articles: Article[];
  createdAt: number;
  linkedFolder?: string;
}

export interface SeriesArticle {
  id: string;
  title: string;
  description: string;
  targetWordCount?: number;
  status: "planned" | "outlining" | "writing" | "reviewing" | "complete" | "draft" | "published";
  articleId?: string;
  previousArticleId?: string;
  nextArticleId?: string;
  order?: number;
}

export interface SeriesPlan {
  id: string;
  title: string;
  createdAt: number;
  tone?: string;
  targetAudience?: string;
  skillId?: string;
  styleId?: string;
  actionId?: string;
  articles: SeriesArticle[];
  description?: string;
  totalArticles?: number;
  updatedAt?: number;
}

export interface TrashItem {
  id: string;
  title: string;
  collectionId: string;
  collectionTitle: string;
  deletedAt: number;
  articleId?: string;
  originalCollectionId?: string;
  phase?: string;
}

export interface SearchResult {
  articleId: string;
  collectionId: string;
  collectionTitle: string;
  title: string;
  matchType: "title" | "content";
  snippet?: string;
  score: number;
}
