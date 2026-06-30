// index.ts — collections 模块统一导出
export type {
  Article, Collection, SeriesPlan, SeriesArticle, TrashItem,
  ProjectContext, FileNode, ProjectSummary, LanguageStat,
  FileInfo, ConfigFile, SymbolInfo, ImportEdge,
  FileContent, SearchResult,
} from "./types";

export { genId, browserLoad, browserSave } from "./internal";

export {
  seedIfEmpty, loadCollections, saveCollections, forceSync,
  addCollection, renameCollection, removeCollection, updateCollection,
  addArticle, renameArticle, trashArticle,
  loadTrash, saveTrash, restoreArticle,
  permanentlyDeleteArticle, emptyTrash,
  unlinkCollectionFolder, getCollectionFolderContext,
} from "./crud";

export {
  linkCollectionFolder, getProjectContext, getProjectContextText,
  rescanProjectFolder, readProjectFiles, findAndReadRelevantFiles,
} from "./projectContext";

export {
  generateSeriesId, saveSeriesPlan, loadAllSeriesPlans,
  loadSeriesPlan, deleteSeriesPlan,
} from "./series";

export { searchArticleTitles, searchArticleContent } from "./search";
