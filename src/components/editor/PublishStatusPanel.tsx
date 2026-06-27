import { useState } from "react";
import type { PublishRecord } from "../../lib/storage/platforms";

interface PublishStatusPanelProps {
  publishRecords: PublishRecord[];
  onPublish: () => void;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  published: "已发布",
  failed: "失败",
};

const PLATFORM_LABELS: Record<string, string> = {
  wechat: "微信公众号",
  toutiao: "今日头条",
};

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("zh-CN");
  } catch {
    return String(ts);
  }
}

export function PublishStatusPanel({ publishRecords, onPublish }: PublishStatusPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const hasUnpublished = publishRecords.length === 0;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="final-publish-status">
      <div className="final-publish-status__head">
        <span>发布状态</span>
        <button type="button" className="btn btn--small btn--primary" onClick={onPublish}>
          {hasUnpublished ? "发布" : "再次发布"}
        </button>
      </div>
      {publishRecords.length === 0 ? (
        <div className="final-publish-status__empty">尚未发布到任何平台</div>
      ) : (
        <div className="final-publish-status__list">
          {publishRecords.map((r) => (
            <div key={r.id} className="final-publish-status__item">
              <div
                className="final-publish-status__item-row"
                onClick={() => toggleExpand(r.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(r.id); } }}
              >
                <span className="final-publish-status__platform">
                  {PLATFORM_LABELS[r.platform] || r.platform}
                </span>
                <span className={`final-publish-status__status final-publish-status__status--${r.status}`}>
                  {STATUS_LABELS[r.status] || r.status}
                </span>
                {r.platformUrl && (
                  <a
                    href={r.platformUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="final-publish-status__link"
                    onClick={(e) => e.stopPropagation()}
                  >
                    查看
                  </a>
                )}
                <span className="final-publish-status__expand-icon">{expandedId === r.id ? "▲" : "▼"}</span>
              </div>
              {expandedId === r.id && (
                <div className="final-publish-status__details">
                  {r.platformArticleId && (
                    <div className="final-publish-status__detail-row">
                      <span className="final-publish-status__detail-label">文章ID：</span>
                      <span className="final-publish-status__detail-value">{r.platformArticleId}</span>
                    </div>
                  )}
                  <div className="final-publish-status__detail-row">
                    <span className="final-publish-status__detail-label">发布时间：</span>
                    <span className="final-publish-status__detail-value">{formatTime(r.publishedAt)}</span>
                  </div>
                  {r.errorMessage && (
                    <div className="final-publish-status__detail-row">
                      <span className="final-publish-status__detail-label">错误信息：</span>
                      <span className="final-publish-status__detail-value final-publish-status__detail-value--error">{r.errorMessage}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
