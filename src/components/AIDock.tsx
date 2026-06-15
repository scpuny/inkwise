import { useState, useEffect, type ReactNode } from "react";
import { Sparkles, Edit3, BarChart3, RefreshCw } from "lucide-react";

type TabId = "suggestion" | "rewrite" | "analysis";

const tabs: { id: TabId; icon: ReactNode; label: string }[] = [
  { id: "suggestion", icon: <Sparkles size={13} />, label: "建议" },
  { id: "rewrite", icon: <Edit3 size={13} />, label: "改写" },
  { id: "analysis", icon: <BarChart3 size={13} />, label: "文风" },
];

export function AIDock() {
  const [activeTab, setActiveTab] = useState<TabId>("suggestion");
  const [selectedText, setSelectedText] = useState("");

  // Track editor selection
  useEffect(() => {
    const handler = () => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || "";
      setSelectedText(text);
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  // Get character stats from editor
  const editor = (window as any).editorInstance?.editor;
  const fullText = editor?.getText() || "";
  const charCount = fullText.length;
  const cnChars = (fullText.match(/[\u4e00-\u9fff]/g) || []).length;
  const westernWords = fullText.replace(/[\u4e00-\u9fff]/g, " ").trim().split(/\s+/).filter(Boolean).length;
  const wordCount = cnChars + westernWords;
  const paragraphs = fullText.split(/\n\s*\n/).filter(Boolean).length;
  const avgSentenceLength = wordCount > 0 ? Math.round(charCount / Math.max(paragraphs, 1)) : 0;

  const suggestionItems = selectedText
    ? [
        `选中文本共 ${selectedText.length} 字，可考虑增加细节描写来增强画面感。`,
        `当前段落句式较为单一，建议混合使用长短句改善节奏。`,
        `可在此处增加一个过渡句，使上下文衔接更自然。`,
      ]
    : [
        "标题可更具吸引力，建议加入具体意象或数字。",
        "首段建议控制在 200 字以内，快速进入主题。",
        "适当使用短句可以增强节奏感，提升可读性。",
      ];

  const rewriteItems = selectedText
    ? [
        { meta: "更简洁", text: `简洁版：${selectedText.slice(0, 60)}…（选中文本后可用 AI 改写）` },
        { meta: "更正式", text: `正式版：${selectedText.slice(0, 60)}…（选中文本后可用 AI 改写）` },
      ]
    : [
        { meta: "提示", text: "在编辑器中选择文本后，可在此查看多个改写版本。" },
      ];

  return (
    <aside className="ai-dock" aria-label="AI 辅助">
      <div className="ai-dock__tabs" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`ai-dock__tab${activeTab === tab.id ? " ai-dock__tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="ai-dock__panels">
        {/* 建议 */}
        <div className={`ai-dock__panel${activeTab === "suggestion" ? " ai-dock__panel--active" : ""}`}>
          {selectedText && (
            <div className="suggestion-item" style={{ borderColor: "var(--accent-soft)", background: "var(--accent-soft)" }}>
              <div className="suggestion-item__meta">已选中 {selectedText.length} 字</div>
            </div>
          )}
          {suggestionItems.map((s, i) => (
            <div key={i} className="suggestion-item">
              <div className="suggestion-item__text">{s}</div>
              <div className="suggestion-item__actions">
                <button className="suggestion-item__btn suggestion-item__btn--apply">应用建议</button>
                <button className="suggestion-item__btn">忽略</button>
              </div>
            </div>
          ))}
        </div>

        {/* 改写 */}
        <div className={`ai-dock__panel${activeTab === "rewrite" ? " ai-dock__panel--active" : ""}`}>
          {rewriteItems.map((r, i) => (
            <div key={i} className="suggestion-item">
              <div className="suggestion-item__meta">{r.meta}</div>
              <div className="suggestion-item__text">{r.text}</div>
              {selectedText && (
                <div className="suggestion-item__actions">
                  <button className="suggestion-item__btn suggestion-item__btn--apply">替换原文</button>
                  <button className="suggestion-item__btn">
                    <Sparkles size={11} /> AI 改写
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 文风 */}
        <div className={`ai-dock__panel${activeTab === "analysis" ? " ai-dock__panel--active" : ""}`}>
          <div className="analysis-card">
            <div className="analysis-card__label">字数统计</div>
            <div className="analysis-card__value">
              <span className="analysis-card__score">{wordCount}</span>
              <span className="analysis-card__unit">字 · {charCount} 字符</span>
            </div>
            <div className="analysis-card__bar">
              <div className="analysis-card__fill" style={{ width: `${Math.min(100, wordCount / 5)}%` }} />
            </div>
            <div className="analysis-card__desc">
              {paragraphs} 段落 · 平均 {avgSentenceLength} 字/段
            </div>
          </div>

          <div className="analysis-card">
            <div className="analysis-card__label">选中文本</div>
            <div className="analysis-card__value">
              <span className="analysis-card__score">{selectedText.length || "—"}</span>
              <span className="analysis-card__unit">{selectedText ? "字" : "未选中"}</span>
            </div>
          </div>

          {selectedText && (
            <div className="analysis-card">
              <div className="analysis-card__label">关键词</div>
              <div className="analysis-card__tag-bar">
                {["写作", "编辑", "AI"].map((kw) => (
                  <span key={kw} className="analysis-card__tag">{kw}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
