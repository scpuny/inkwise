import { useState, useCallback, useRef, useEffect } from "react";
import { Search, FileCode, X, Loader2, ExternalLink } from "lucide-react";
import { invokeOrFallback, TauriCommands } from "../../lib/bridge/tauri";

interface CodeGraphSymbol {
  name: string;
  kind: string;
  file: string;
  line?: number;
}

interface CodeGraphSearchProps {
  onSelectSymbol?: (symbol: CodeGraphSymbol) => void;
}

function parseExploreOutput(output: string): CodeGraphSymbol[] {
  const symbols: CodeGraphSymbol[] = [];
  let currentFile = "";

  for (const line of output.split("\n")) {
    const fileMatch = line.match(/^# File:\s+(.+)/);
    if (fileMatch) {
      currentFile = fileMatch[1].trim();
      continue;
    }
    const symbolMatch = line.match(/^##\s+(Function|Class|Interface|Type|Variable|Method|Route|Component):\s+(.+)/);
    if (symbolMatch && currentFile) {
      symbols.push({
        kind: symbolMatch[1].toLowerCase(),
        name: symbolMatch[2].trim(),
        file: currentFile,
      });
      continue;
    }
    const lineMatch = line.match(/^\s+File:\s+(.+):(\d+)/);
    if (lineMatch && symbols.length > 0) {
      symbols[symbols.length - 1].file = lineMatch[1].trim();
      symbols[symbols.length - 1].line = parseInt(lineMatch[2], 10);
    }
  }
  return symbols;
}

const KIND_LABELS: Record<string, string> = {
  function: "函数",
  method: "方法",
  class: "类",
  interface: "接口",
  type: "类型",
  variable: "变量",
  route: "路由",
  component: "组件",
};

const KIND_ICONS: Record<string, React.ReactNode> = {
  function: <FileCode size={13} />,
  method: <FileCode size={13} />,
  class: <FileCode size={13} />,
  interface: <FileCode size={13} />,
  type: <FileCode size={13} />,
  variable: <FileCode size={13} />,
  route: <FileCode size={13} />,
  component: <FileCode size={13} />,
};

export function CodeGraphSearch({ onSelectSymbol }: CodeGraphSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CodeGraphSymbol[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const doSearch = useCallback(async (value: string) => {
    if (!value.trim()) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const output = await invokeOrFallback<string>(
        TauriCommands.CodeGraphExplore,
        { query: value },
        () => "",
      );
      if (output) {
        setResults(parseExploreOutput(output));
      } else {
        // If empty string returned from fallback, CLI not available
        setError("CodeGraph CLI 未安装或不可用");
        setResults([]);
      }
    } catch {
      setError("查询失败");
      setResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, []);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setResults([]);
      setSearched(false);
      setError(null);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }, [doSearch]);

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setSearched(false);
    setError(null);
    inputRef.current?.focus();
  }, []);

  return (
    <div className="codegraph-search">
      <div className="codegraph-search__input-wrap">
        <Search size={14} className="codegraph-search__input-icon" />
        <input
          ref={inputRef}
          className="codegraph-search__input"
          type="text"
          placeholder="输入关键词搜索代码符号..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleClear();
          }}
        />
        {query && (
          <button className="codegraph-search__clear" onClick={handleClear} aria-label="清除搜索">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="codegraph-search__results">
        {!query.trim() && !searched && (
          <div className="codegraph-search__hint">
            输入关键词搜索代码符号...
          </div>
        )}

        {searching && (
          <div className="codegraph-search__loading">
            <Loader2 size={14} className="codegraph-search__spinner" />
            <span>搜索中...</span>
          </div>
        )}

        {error && !searching && (
          <div className="codegraph-search__error">
            <span>{error}</span>
          </div>
        )}

        {searched && !searching && !error && results.length === 0 && query.trim() && (
          <div className="codegraph-search__empty">
            <Search size={20} />
            <span>未找到匹配结果</span>
          </div>
        )}

        {results.length > 0 && (
          <div className="codegraph-search__list">
            {results.map((sym, i) => (
              <button
                key={`${sym.file}-${sym.name}-${i}`}
                className="codegraph-search__item"
                onClick={() => onSelectSymbol?.(sym)}
              >
                <div className="codegraph-search__item-icon">
                  {KIND_ICONS[sym.kind] || <FileCode size={13} />}
                </div>
                <div className="codegraph-search__item-body">
                  <span className="codegraph-search__item-name">{sym.name}</span>
                  <span className="codegraph-search__item-meta">
                    <span className={`codegraph-search__kind-tag codegraph-search__kind-tag--${sym.kind}`}>
                      {KIND_LABELS[sym.kind] || sym.kind}
                    </span>
                    <span className="codegraph-search__item-file">
                      <ExternalLink size={10} />
                      {sym.file}{sym.line ? `:${sym.line}` : ""}
                    </span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export type { CodeGraphSymbol };
