// index.ts — collections 模块统一导出
// v2.0.0: 精简为 4 文件（types/crud/projectContext/index）
export type {
  Article, Collection, SeriesPlan, SeriesArticle, TrashItem,
  ProjectContext, FileNode, ProjectSummary, LanguageStat,
  FileInfo, ConfigFile, SymbolInfo, ImportEdge,
  FileContent, SearchResult,
} from "./types";

export {
  genId, browserLoad, browserSave,
  seedIfEmpty, loadCollections, saveCollections, forceSync,
  addCollection, renameCollection, removeCollection, updateCollection,
  addArticle, renameArticle, trashArticle,
  loadTrash, saveTrash, restoreArticle,
  permanentlyDeleteArticle, emptyTrash,
  unlinkCollectionFolder, getCollectionFolderContext,
  generateSeriesId, saveSeriesPlan, loadAllSeriesPlans,
  loadSeriesPlan, deleteSeriesPlan,
} from "./crud";

export {
  searchArticleTitles, searchArticleContent,
} from "./search";

export {
  linkCollectionFolder, getProjectContext, getProjectContextText,
  rescanProjectFolder, readProjectFiles, findAndReadRelevantFiles,
} from "./projectContext";
