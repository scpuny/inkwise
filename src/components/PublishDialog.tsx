import { useState, useEffect } from "react";
import { getPlatformConfigs } from "../lib/platforms";
import type { PlatformConfig, PublishOptions, PublishResult } from "../lib/platforms";

interface PublishDialogProps {
  articleTitle: string;
  markdown: string;
  onClose: () => void;
  onSubmit: (platform: string, options: PublishOptions, action: "draft" | "publish") => Promise<PublishResult>;
}

export function PublishDialog({ articleTitle, markdown, onClose, onSubmit }: PublishDialogProps) {
  const [configs, setConfigs] = useState<PlatformConfig[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("wechat");
  const [summary, setSummary] = useState("");
  const [declareOriginal, setDeclareOriginal] = useState(true);
  const [allowReprint, setAllowReprint] = useState(true);
  const [chargeable, setChargeable] = useState(false);
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PublishResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPlatformConfigs().then((cfgs) => {
      setConfigs(cfgs.filter((c) => c.enabled));
      // Auto-extract summary from markdown
      const firstPara = markdown
        .split("\n")
        .find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("![") && !l.startsWith("```"));
      if (firstPara) {
        setSummary(firstPara.trim().slice(0, 120));
      }
    });
  }, [markdown]);

  const enabledPlatform = configs.find((c) => c.platform === selectedPlatform);

  const handleAction = async (action: "draft" | "publish") => {
    if (!enabledPlatform) {
      setError("请先在设置中配置平台凭据");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);

    const options: PublishOptions = {
      summary: summary || undefined,
      declareOriginal,
      allowReprint,
      chargeable,
      author: author || undefined,
    };

    try {
      const res = await onSubmit(selectedPlatform, options, action);
      if (res.success) {
        setResult(res);
      } else {
        setError(res.errorMessage || "发布失败");
      }
    } catch (e: any) {
      setError(e?.message || "发布异常");
    }
    setBusy(false);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog publish-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__head">
          <h3>发布文章</h3>
          <button className="dialog__close" onClick={onClose}>✕</button>
        </div>

        {result ? (
          <div className="publish-dialog__result">
            <div className={`publish-result-icon ${result.success ? "publish-result-icon--ok" : "publish-result-icon--fail"}`}>
              {result.success ? "✅" : "❌"}
            </div>
            <p>{result.isDraft ? "草稿已创建成功！" : "已成功发布！"}</p>
            {result.isDraft && (
              <p className="publish-dialog__hint">可前往公众号后台审核后发布。</p>
            )}
            {result.errorMessage && (
              <p className="publish-dialog__error">{result.errorMessage}</p>
            )}
            <button type="button" className="btn btn--small" onClick={onClose}>关闭</button>
          </div>
        ) : (
          <>
            <div className="publish-dialog__body">
              <div className="publish-dialog__field">
                <label>平台</label>
                <select
                  className="input"
                  value={selectedPlatform}
                  onChange={(e) => setSelectedPlatform(e.target.value)}
                >
                  {configs.length === 0 ? (
                    <option value="">未配置可用平台</option>
                  ) : (
                    configs.map((cfg) => (
                      <option key={cfg.id} value={cfg.platform}>
                        {cfg.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="publish-dialog__field">
                <label>文章</label>
                <span className="publish-dialog__article-title">{articleTitle}</span>
              </div>

              <div className="publish-dialog__field">
                <label>摘要</label>
                <textarea
                  className="input publish-dialog__textarea"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  maxLength={120}
                />
                <span className="publish-dialog__counter">{summary.length}/120</span>
              </div>

              <div className="publish-dialog__field">
                <label>作者</label>
                <input
                  type="text"
                  className="input"
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  placeholder="可选"
                />
              </div>

              <div className="publish-dialog__checks">
                <label className="checkbox-label">
                  <input type="checkbox" checked={declareOriginal} onChange={(e) => setDeclareOriginal(e.target.checked)} />
                  <span>声明原创</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={allowReprint} onChange={(e) => setAllowReprint(e.target.checked)} />
                  <span>允许转载</span>
                </label>
                <label className="checkbox-label">
                  <input type="checkbox" checked={chargeable} onChange={(e) => setChargeable(e.target.checked)} />
                  <span>付费阅读</span>
                </label>
              </div>

              {error && <div className="publish-dialog__error">{error}</div>}
            </div>

            <div className="publish-dialog__actions">
              <button
                type="button"
                className="btn btn--small"
                disabled={busy || configs.length === 0}
                onClick={() => handleAction("draft")}
              >
                {busy ? "处理中..." : "存入草稿箱"}
              </button>
              <button
                type="button"
                className="btn btn--small btn--primary"
                disabled={busy || configs.length === 0}
                onClick={() => handleAction("publish")}
              >
                {busy ? "处理中..." : "直接发布"}
              </button>
              <button type="button" className="btn btn--small" onClick={onClose} disabled={busy}>
                取消
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
