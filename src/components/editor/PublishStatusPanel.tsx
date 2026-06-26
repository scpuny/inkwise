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

export function PublishStatusPanel({ publishRecords, onPublish }: PublishStatusPanelProps) {
  const hasUnpublished = publishRecords.length === 0;

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
                >
                  查看
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
