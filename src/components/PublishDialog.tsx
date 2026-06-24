import { useState, useEffect, useRef } from "react";
import { getPlatformConfigs } from "../lib/platforms";
import type { PlatformConfig, PublishOptions, PublishResult } from "../lib/platforms";

interface PublishDialogProps {
  articleTitle: string;
  markdown: string;
  onClose: () => void;
  onSubmit: (platform: string, options: PublishOptions, action: "draft" | "publish") => Promise<PublishResult>;
}

/** Extract image URLs from markdown content */
function extractImagesFromMarkdown(md: string): string[] {
  const urls: string[] = [];
  const mdRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = mdRe.exec(md)) !== null) urls.push(m[2]);
  const htmlRe = /<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi;
  while ((m = htmlRe.exec(md)) !== null) urls.push(m[1]);
  return urls;
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

  // Cover
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [bodyImages, setBodyImages] = useState<string[]>([]);
  const [category, setCategory] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getPlatformConfigs().then((cfgs) => {
      setConfigs(cfgs.filter((c) => c.enabled));
      const firstPara = markdown
        .split("\n")
        .find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("![") && !l.startsWith("```"));
      if (firstPara) setSummary(firstPara.trim().slice(0, 120));
      setBodyImages(extractImagesFromMarkdown(markdown));
    });
  }, [markdown]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSelectBodyImage = (url: string) => {
    setCoverPreview(url);
    setCoverFile(null);
  };

  const enabledPlatform = configs.find((c) => c.platform === selectedPlatform);

  const handleAction = async (action: "draft" | "publish") => {
    if (!enabledPlatform) { setError("请先在设置中配置平台凭据"); return; }
    setBusy(true); setError(null); setResult(null);
    const options: PublishOptions = {
      coverImage: coverPreview || undefined,
      summary: summary || undefined,
      declareOriginal, allowReprint, chargeable,
      author: author || undefined,
    };
    try {
      const res = await onSubmit(selectedPlatform, options, action);
      if (res.success) setResult(res);
      else setError(res.errorMessage || "发布失败");
    } catch (e: any) {
      setError(e?.message || "发布异常");
    }
    setBusy(false);
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog publish-dialog publish-dialog--wide" onClick={(e) => e.stopPropagation()}>
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
            {result.isDraft && <p className="publish-dialog__hint">可前往公众号后台审核后发布。</p>}
            {result.errorMessage && <p className="publish-dialog__error">{result.errorMessage}</p>}
            <button type="button" className="btn btn--small" onClick={onClose}>关闭</button>
          </div>
        ) : (
          <>
            <div className="publish-dialog__body">
              {/* ── Row 1: Platform + Title (two-col) ── */}
              <div className="publish-dialog__row publish-dialog__row--two">
                <div className="publish-dialog__field">
                  <label>发布平台</label>
                  <select className="input" value={selectedPlatform}
                    onChange={(e) => setSelectedPlatform(e.target.value)}>
                    {configs.length === 0 ? (
                      <option value="">未配置可用平台</option>
                    ) : configs.map((cfg) => (
                      <option key={cfg.id} value={cfg.platform}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <div className="publish-dialog__field">
                  <label>文章</label>
                  <span className="publish-dialog__article-title">{articleTitle}</span>
                </div>
              </div>

              {/* ── Row 2: Cover image (two-col: upload + body images) ── */}
              <div className="publish-dialog__row publish-dialog__row--two">
                {/* Left: Upload box */}
                <div className="publish-dialog__field">
                  <label>封面图</label>
                  <div
                    className="publish-dialog__cover-upload"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {coverPreview ? (
                      <div className="publish-dialog__cover-preview">
                        <img src={coverPreview} alt="封面" />
                        <button
                          className="publish-dialog__cover-remove"
                          onClick={(e) => { e.stopPropagation(); setCoverPreview(""); setCoverFile(null); }}
                        >✕</button>
                      </div>
                    ) : (
                      <div className="publish-dialog__cover-placeholder">
                        <span>点击上传封面图</span>
                        <span className="publish-dialog__cover-hint">建议尺寸 900×383（1.91:1）</span>
                      </div>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp"
                      style={{ display: "none" }} onChange={handleFilePick} />
                  </div>
                </div>

                {/* Right: Body image thumbnails */}
                <div className="publish-dialog__field">
                  <label>正文图片</label>
                  {bodyImages.length === 0 ? (
                    <div className="publish-dialog__body-empty">正文中未检测到图片</div>
                  ) : (
                    <div className="publish-dialog__body-images">
                      {bodyImages.map((url, i) => (
                        <button key={i}
                          className={`publish-dialog__body-img${coverPreview === url ? " publish-dialog__body-img--active" : ""}`}
                          onClick={() => handleSelectBodyImage(url)}
                          title={`选择作为封面`}
                        >
                          <img src={url} alt={`图${i + 1}`} />
                        </button>
                      ))}
                    </div>
                  )}
                  {bodyImages.length > 6 && (
                    <div className="publish-dialog__body-more">共 {bodyImages.length} 张图片，点击选择作为封面</div>
                  )}
                </div>
              </div>

              {/* ── Row 3: Summary (full width) ── */}
              <div className="publish-dialog__row">
                <div className="publish-dialog__field">
                  <label>摘要</label>
                  <textarea className="input publish-dialog__textarea" value={summary}
                    onChange={(e) => setSummary(e.target.value)} rows={3} maxLength={120}
                    placeholder="选填，将在公众号卡片中显示" />
                  <span className="publish-dialog__counter">{summary.length}/120</span>
                </div>
              </div>

              {/* ── Row 4: Author + Category + Tags + Options (two-col) ── */}
              <div className="publish-dialog__row publish-dialog__row--two">
                <div className="publish-dialog__field">
                  <label>作者</label>
                  <input type="text" className="input" value={author}
                    onChange={(e) => setAuthor(e.target.value)} placeholder="公众号作者名" />
                </div>
                <div className="publish-dialog__field">
                  <label>分类</label>
                  <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="">选择分类</option>
                    <option value="tech">科技</option>
                    <option value="life">生活</option>
                    <option value="edu">教育</option>
                    <option value="finance">财经</option>
                    <option value="health">健康</option>
                    <option value="culture">文化</option>
                    <option value="other">其他</option>
                  </select>
                </div>
              </div>

              {/* ── Row 5: Options (full width) ── */}
              <div className="publish-dialog__row">
                <div className="publish-dialog__checks">
                  <label className="checkbox-label">
                    <input type="checkbox" checked={declareOriginal}
                      onChange={(e) => setDeclareOriginal(e.target.checked)} />
                    <span>声明原创</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={allowReprint}
                      onChange={(e) => setAllowReprint(e.target.checked)} />
                    <span>允许转载</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={chargeable}
                      onChange={(e) => setChargeable(e.target.checked)} />
                    <span>付费阅读</span>
                  </label>
                </div>
              </div>

              {error && <div className="publish-dialog__error">{error}</div>}
            </div>

            <div className="publish-dialog__actions">
              <button type="button" className="btn btn--small" disabled={busy || configs.length === 0}
                onClick={() => handleAction("draft")}>
                {busy ? "处理中..." : "存入草稿箱"}
              </button>
              <button type="button" className="btn btn--small btn--primary" disabled={busy || configs.length === 0}
                onClick={() => handleAction("publish")}>
                {busy ? "处理中..." : "直接发布"}
              </button>
              <button type="button" className="btn btn--small" onClick={onClose} disabled={busy}>取消</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
