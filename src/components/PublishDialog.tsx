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
  // Markdown images: ![alt](url)
  const mdRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m;
  while ((m = mdRe.exec(md)) !== null) {
    urls.push(m[2]);
  }
  // HTML images: <img src="url">
  const htmlRe = /<img[^>]+src=["']([^"']+)["'][^>]*\/?>/gi;
  while ((m = htmlRe.exec(md)) !== null) {
    urls.push(m[1]);
  }
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

  // Cover image
  const [coverSource, setCoverSource] = useState<"upload" | "body">("body");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [bodyImages, setBodyImages] = useState<string[]>([]);
  const [selectedBodyImage, setSelectedBodyImage] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tags / categories
  const [category, setCategory] = useState("");
  const [tags, setTags] = useState("");

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
      // Extract images from markdown
      setBodyImages(extractImagesFromMarkdown(markdown));
      // Auto-select first body image as cover if available
      const imgs = extractImagesFromMarkdown(markdown);
      if (imgs.length > 0) {
        setSelectedBodyImage(imgs[0]);
        setCoverPreview(imgs[0]);
      }
    });
  }, [markdown]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverSource("upload");
    // Show local preview
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCoverPreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSelectBodyImage = (url: string) => {
    setSelectedBodyImage(url);
    setCoverSource("body");
    setCoverPreview(url);
    setCoverFile(null);
  };

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
      coverImage: coverPreview || undefined,
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
      <div className="dialog publish-dialog publish-dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div className="dialog__head">
          <h3>发布到 {enabledPlatform?.label || "微信公众号"}</h3>
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
            <div className="publish-dialog__body publish-dialog__body--two-col">
              {/* ═══ Left column: Cover + Summary ═══ */}
              <div className="publish-dialog__col publish-dialog__col--left">
                {/* ── Cover image ── */}
                <div className="publish-dialog__field">
                  <label>封面图</label>
                  <div className="publish-dialog__cover-area">
                    {coverPreview ? (
                      <div className="publish-dialog__cover-preview">
                        <img src={coverPreview} alt="封面预览" />
                        <button
                          className="publish-dialog__cover-remove"
                          onClick={() => { setCoverPreview(""); setCoverFile(null); setSelectedBodyImage(""); }}
                          title="移除封面"
                        >✕</button>
                      </div>
                    ) : (
                      <div className="publish-dialog__cover-placeholder">
                        <span>点击选择封面图</span>
                      </div>
                    )}
                    {/* Upload controls */}
                    <div className="publish-dialog__cover-actions">
                      <button
                        type="button"
                        className={`btn btn--tiny${coverSource === "upload" && coverFile ? " btn--active" : ""}`}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        上传图片
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        style={{ display: "none" }}
                        onChange={handleFilePick}
                      />
                      {bodyImages.length > 0 && (
                        <button
                          type="button"
                          className={`btn btn--tiny${coverSource === "body" && selectedBodyImage ? " btn--active" : ""}`}
                          onClick={() => setCoverSource("body")}
                        >
                          从正文选择
                        </button>
                      )}
                    </div>
                    {/* Body image picker */}
                    {coverSource === "body" && bodyImages.length > 0 && (
                      <div className="publish-dialog__body-images">
                        {bodyImages.map((url, i) => (
                          <button
                            key={i}
                            className={`publish-dialog__body-image-item${selectedBodyImage === url ? " publish-dialog__body-image-item--active" : ""}`}
                            onClick={() => handleSelectBodyImage(url)}
                          >
                            <img src={url} alt={`正文图 ${i + 1}`} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Summary ── */}
                <div className="publish-dialog__field">
                  <label>摘要（选填）</label>
                  <textarea
                    className="input publish-dialog__textarea"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={3}
                    maxLength={120}
                    placeholder="文章摘要，将在公众号卡片中显示"
                  />
                  <span className="publish-dialog__counter">{summary.length}/120</span>
                </div>

                {/* ── Category ── */}
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

              {/* ═══ Right column: Options ═══ */}
              <div className="publish-dialog__col publish-dialog__col--right">
                {/* ── Platform ── */}
                <div className="publish-dialog__field">
                  <label>发布平台</label>
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

                {/* ── Article title ── */}
                <div className="publish-dialog__field">
                  <label>文章标题</label>
                  <span className="publish-dialog__article-title">{articleTitle}</span>
                </div>

                {/* ── Author ── */}
                <div className="publish-dialog__field">
                  <label>作者</label>
                  <input
                    type="text"
                    className="input"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="公众号作者名"
                  />
                </div>

                {/* ── Tags ── */}
                <div className="publish-dialog__field">
                  <label>标签</label>
                  <input
                    type="text"
                    className="input"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="用逗号分隔，如: Spring Boot, RabbitMQ"
                  />
                </div>

                {/* ── Options ── */}
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
