interface ArticleInfoPanelProps {
  title: string;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  coverImage?: string | null;
}

export function ArticleInfoPanel({ title, wordCount, createdAt, updatedAt, tags, coverImage }: ArticleInfoPanelProps) {
  const fmtDate = (ts: number) => {
    if (!ts) return "-";
    return new Date(ts).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
  };

  return (
    <div className="final-info-panel">
      {coverImage && (
        <div className="final-info-cover">
          <img src={coverImage} alt="封面" />
        </div>
      )}
      <div className="final-info-row">
        <span className="final-info-label">标题</span>
        <span className="final-info-value">{title}</span>
      </div>
      <div className="final-info-row">
        <span className="final-info-label">字数</span>
        <span className="final-info-value">{wordCount.toLocaleString()}</span>
      </div>
      <div className="final-info-row">
        <span className="final-info-label">创建</span>
        <span className="final-info-value">{fmtDate(createdAt)}</span>
      </div>
      <div className="final-info-row">
        <span className="final-info-label">更新</span>
        <span className="final-info-value">{fmtDate(updatedAt)}</span>
      </div>
      {tags.length > 0 && (
        <div className="final-info-row">
          <span className="final-info-label">标签</span>
          <span className="final-info-value">
            <div className="final-info-tags">
              {tags.map((t, i) => (
                <span key={i} className="final-info-tag">{t}</span>
              ))}
            </div>
          </span>
        </div>
      )}
    </div>
  );
}
