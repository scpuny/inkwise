import { useState, useCallback, useRef, useEffect } from "react";
import { Search, FileText, FolderClosed, X, Loader2 } from "lucide-react";
import {
  searchArticleTitles,
  searchArticleContent,
  type Collection,
  type SearchResult,
} from "../../lib/storage/collections";
import { loadCollections } from "../../lib/storage/collections";

export interface SearchPanelProps {
  onSelectArticle: (articleId: string) => void;
  onClose: () => void;
}

export function SearchPanel({ onSelectArticle, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchedContent, setSearchedContent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Load collections
  useEffect(() => {
    loadCollections().then(setCollections);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Debounced search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      setSearchedContent(false);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!value.trim()) {
        setResults([]);
        return;
      }

      // Immediate title search
      const titleResults = searchArticleTitles(collections, value);
      setResults(titleResults);

      // Debounced content search (only if meaningful query)
      if (value.trim().length >= 2) {
        debounceRef.current = setTimeout(async () => {
          setSearching(true);
          const excludeIds = new Set(titleResults.map((r) => r.articleId));
          const contentResults = await searchArticleContent(collections, value, excludeIds);
          setResults((prev) => [...prev, ...contentResults]);
          setSearchedContent(true);
          setSearching(false);
        }, 400);
      }
    },
    [collections],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    inputRef.current?.focus();
  }, []);

  return (
    <div className="search-panel">
      {/* Search input */}
      <div className="search-panel__input-wrap">
        <Search size={14} className="search-panel__input-icon" />
        <input
          ref={inputRef}
          className="search-panel__input"
          type="text"
          placeholder="搜索文档标题和内容…"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "Enter" && results.length > 0) {
              onSelectArticle(results[0].articleId);
              onClose();
            }
          }}
        />
        {query && (
          <button className="search-panel__clear" onClick={handleClear} aria-label="清除搜索">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Results */}
      <div className="search-panel__results">
        {!query.trim() && (
          <div className="search-panel__hint">
            输入关键词搜索文档标题和内容
          </div>
        )}

        {query.trim() && results.length === 0 && !searching && (
          <div className="search-panel__empty">
            <Search size={20} />
            <span>未找到匹配的文档</span>
          </div>
        )}

        {searching && (
          <div className="search-panel__loading">
            <Loader2 size={14} className="search-panel__spinner" />
            <span>搜索内容中…</span>
          </div>
        )}

        {results.length > 0 && (
          <div className="search-panel__list">
            {results.map((r, i) => (
              <button
                key={`${r.articleId}-${i}`}
                className="search-panel__item"
                onClick={() => {
                  onSelectArticle(r.articleId);
                  onClose();
                }}
              >
                <div className="search-panel__item-icon">
                  {r.matchType === "title" ? (
                    <FileText size={13} />
                  ) : (
                    <Search size={12} />
                  )}
                </div>
                <div className="search-panel__item-body">
                  <span className="search-panel__item-title">
                    {highlightMatch(r.title, query)}
                  </span>
                  {r.snippet && (
                    <span className="search-panel__item-snippet">
                      {highlightMatch(r.snippet, query)}
                    </span>
                  )}
                  <span className="search-panel__item-meta">
                    <FolderClosed size={10} />
                    {r.collectionTitle}
                    {r.matchType === "content" ? " · 内容匹配" : " · 标题匹配"}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {searchedContent && results.length > 0 && (
          <div className="search-panel__footnote">
            共 {results.length} 条结果
          </div>
        )}
      </div>
    </div>
  );
}

/** Highlight matching text with <mark> tags */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="search-panel__highlight">{part}</mark>
    ) : (
      part
    ),
  );
}
