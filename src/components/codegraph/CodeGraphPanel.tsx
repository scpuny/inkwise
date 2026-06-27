import { useState, useEffect } from "react";
import { Brain, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { invokeOrFallback, TauriCommands } from "../../lib/bridge/tauri";
import { CodeGraphSearch } from "./CodeGraphSearch";
import type { CodeGraphSymbol } from "./CodeGraphSearch";

type CodegraphStatus = "checking" | "ready" | "unavailable";

interface CodegraphStats {
  fileCount?: number;
  dbSize?: string;
}

export function CodeGraphPanel() {
  const [status, setStatus] = useState<CodegraphStatus>("checking");
  const [stats, setStats] = useState<CodegraphStats | null>(null);

  useEffect(() => {
    checkCodegraph();
  }, []);

  async function checkCodegraph() {
    setStatus("checking");
    try {
      const version = await invokeOrFallback<string>(
        TauriCommands.CodeGraphVersion,
        {},
        () => "",
      );
      if (version) {
        setStatus("ready");
        // Attempt to read stats via invoke (will fallback if not implemented)
        const dbInfo = await invokeOrFallback<string>(
          TauriCommands.CodeGraphExplore,
          { query: "__stats__" },
          () => null,
        );
        if (dbInfo) {
          try {
            const parsed = JSON.parse(dbInfo);
            setStats(parsed);
          } catch {
            // Not JSON, ignore
          }
        }
      } else {
        setStatus("unavailable");
      }
    } catch {
      setStatus("unavailable");
    }
  }

  const handleSelectSymbol = (sym: CodeGraphSymbol) => {
    console.log("[CodeGraph] selected symbol:", sym);
  };

  return (
    <div className="codegraph-panel">
      {/* Title */}
      <div className="codegraph-panel__header">
        <Brain size={16} className="codegraph-panel__icon" />
        <span className="codegraph-panel__title">代码图谱</span>
      </div>

      {/* Status */}
      <div className="codegraph-panel__status">
        {status === "checking" && (
          <div className="codegraph-panel__status-bar codegraph-panel__status-bar--checking">
            <span className="codegraph-panel__status-dot" />
            检测 CodeGraph 环境...
          </div>
        )}
        {status === "ready" && (
          <div className="codegraph-panel__status-bar codegraph-panel__status-bar--ready">
            <CheckCircle2 size={14} />
            <span>✓ CodeGraph 已就绪</span>
          </div>
        )}
        {status === "unavailable" && (
          <div className="codegraph-panel__status-bar codegraph-panel__status-bar--unavailable">
            <AlertTriangle size={14} />
            <span>未检测到 CodeGraph CLI</span>
          </div>
        )}
      </div>

      {/* Install guide when unavailable */}
      {status === "unavailable" && (
        <div className="codegraph-panel__guide">
          <Info size={12} />
          <span>请安装 CodeGraph 后使用：</span>
          <code className="codegraph-panel__guide-cmd">cargo install codegraph</code>
        </div>
      )}

      {/* Stats info when ready */}
      {status === "ready" && stats && (
        <div className="codegraph-panel__stats">
          {stats.fileCount != null && (
            <div className="codegraph-panel__stat">
              <span className="codegraph-panel__stat-label">索引文件</span>
              <span className="codegraph-panel__stat-value">{stats.fileCount}</span>
            </div>
          )}
          {stats.dbSize && (
            <div className="codegraph-panel__stat">
              <span className="codegraph-panel__stat-label">数据库</span>
              <span className="codegraph-panel__stat-value">{stats.dbSize}</span>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="codegraph-panel__search">
        <CodeGraphSearch onSelectSymbol={handleSelectSymbol} />
      </div>
    </div>
  );
}
