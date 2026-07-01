import { useState, useEffect } from "react";
import { emit } from "../../lib/events/eventBus";
import { Loader2 } from "lucide-react";
import { generateArticleReview, saveArticleReview, loadArticleReview, applyOptimization, type ArticleReview } from "../../lib/ai/articleReview";
import { loadArticleContent, loadArticleMeta, saveArticleContent } from "../../lib/storage/articles";

/* ─── 文章质量评估面板 ─── */
export function ReviewPanel({ articleId }: { articleId: string | null }) {
  const [review, setReview] = useState<ArticleReview | null>(null);
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOptimize, setConfirmOptimize] = useState(false);
  const [articleTitle, setArticleTitle] = useState("");

  // Load existing review on mount
  useEffect(() => {
    if (!articleId) return;
    loadArticleReview(articleId).then(setReview).catch(() => {});
    loadArticleMeta(articleId).then((meta) => {
      if (meta) setArticleTitle(meta.title || "");
    }).catch(() => {});
  }, [articleId]);

  const handleReview = async () => {
    if (!articleId || loading) return;
    setLoading(true);
    setError(null);

    try {
      const content = await loadArticleContent(articleId);
      if (!content || content.trim().length < 50) {
        throw new Error("文章内容不足，至少需要 50 个字符才能评估");
      }

      const result = await generateArticleReview(articleId, content);
      setReview(result);
      await saveArticleReview(articleId, result);
    } catch (e: unknown) {
      console.error("[review] error:", e);
      setError(e instanceof Error ? e.message : "评估失败");
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async () => {
    if (!articleId || !review || optimizing) return;
    // ponytail: inline confirm replaces browser confirm() — Tauri WebView may hide dialog behind window
    setConfirmOptimize(true);
  };

  const executeOptimize = async () => {
    if (!articleId || !review || optimizing) return;
    setConfirmOptimize(false);
    setOptimizing(true);
    setError(null);

    try {
      const content = await loadArticleContent(articleId);
      if (!content) throw new Error("文章内容为空");

      const optimized = await applyOptimization(articleId, content, review, { title: articleTitle });
      if (optimized && optimized.length > 10) {
        await saveArticleContent(articleId, optimized);
        emit("content-saved", { articleId, content: optimized });
        alert("优化完成！已保存到文章。切换到编辑 tab 可查看。");
      }
    } catch (e: unknown) {
      console.error("[optimize] error:", e);
      const fallback = e instanceof Error ? e.message : JSON.stringify(e);
      setError("优化失败: " + fallback);
    } finally {
      setOptimizing(false);
    }
  };

  if (!articleId) {
    return (
      <div className="agent-panel__empty">
        <p>请先打开一篇文章</p>
      </div>
    );
  }

  const RatingBadge = ({ rating }: { rating: "优" | "良" | "差" }) => {
    const colors: Record<string, { bg: string; fg: string }> = {
      "优": { bg: "rgba(9, 105, 218, 0.1)", fg: "var(--accent, #0969da)" },
      "良": { bg: "rgba(212, 146, 11, 0.1)", fg: "var(--warning, #d4920b)" },
      "差": { bg: "rgba(207, 34, 46, 0.1)", fg: "var(--danger, #cf222e)" },
    };
    const style = colors[rating] || colors["良"];
    return (
      <span style={{
        display: "inline-block",
        padding: "1px 8px",
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 600,
        background: style.bg,
        color: style.fg,
      }}>
        {rating}
      </span>
    );
  };

  const DIMENSION_LABELS: Record<string, string> = {
    opening: "开头",
    structure: "结构逻辑",
    content: "内容质量",
    expression: "表达节奏",
    formatting: "格式规范",
  };

  return (
    <div className="agent-panel__panel" style={{ padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "var(--text)" }}>
        文章质量评估
      </div>
      {articleTitle && (
        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 12 }}>
          {articleTitle}
        </div>
      )}

      {review ? (
        <div>
          {Object.entries(review.dimensions).map(([key, dim]) => {
            return (
              <div key={key} style={{
                padding: "8px 0",
                borderBottom: "1px solid var(--border, rgba(128,128,128,0.15))",
                fontSize: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: dim.suggestion ? 4 : 0 }}>
                  <span style={{ width: 56, flexShrink: 0, color: "var(--text)", fontWeight: 500 }}>
                    {DIMENSION_LABELS[key] || key}
                  </span>
                  <RatingBadge rating={dim.rating} />
                  <span style={{ color: "var(--text-secondary)", lineHeight: 1.5 }}>{dim.comment}</span>
                </div>
                {dim.suggestion && (
                  <div style={{
                    marginTop: 4,
                    marginLeft: 64,
                    padding: "4px 8px",
                    borderRadius: 4,
                    background: "rgba(212, 146, 11, 0.08)",
                    borderLeft: "2px solid var(--warning, #d4920b)",
                    color: "var(--text-secondary)",
                    lineHeight: 1.5,
                  }}>
                    <span style={{ fontWeight: 500, color: "var(--warning, #d4920b)" }}>建议：</span>
                    {dim.suggestion}
                  </div>
                )}
              </div>
            );
          })}
                    {error && (
            <div style={{ marginTop: 8, padding: "6px 10px", borderRadius: 4, fontSize: 12, color: "#cf222e", background: "rgba(207,34,46,0.08)", border: "1px solid rgba(207,34,46,0.2)", lineHeight: 1.5 }}>
              ❌ {error}
            </div>
          )}
          {review.summary && (
            <div style={{
              marginTop: 10,
              padding: 8,
              borderRadius: 6,
              background: "rgba(9, 105, 218, 0.06)",
              fontSize: 12,
              color: "var(--text-secondary)",
              lineHeight: 1.5,
              border: "1px solid rgba(9, 105, 218, 0.12)",
            }}>
              <strong style={{ color: "var(--text)" }}>总评：</strong>
              {review.summary}
            </div>
          )}
          <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
          <button className="agent-chat__action agent-chat__action--confirm" onClick={handleReview} disabled={loading || optimizing}>
              {loading ? "评估中…" : "重新评估"}
            </button>
          {confirmOptimize ? (
            <div style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 12, color: "var(--text-secondary)" }}>
              <span style={{ whiteSpace: "nowrap" }}>将消耗 ~4000-8000 token，确定？</span>
              <button className="btn btn--small" style={{ color: "var(--accent, #0969da)" }} onClick={executeOptimize}>确认</button>
              <button className="btn btn--small" onClick={() => setConfirmOptimize(false)}>取消</button>
            </div>
          ) : (
          <button className="agent-chat__action" onClick={handleOptimize} disabled={loading || optimizing}
              style={optimizing ? { opacity: 0.6 } : {}}>
              {optimizing ? (
                <><Loader2 size={12} className="agent-chat__spinner" style={{ marginRight: 4 }} />优化中…</>
              ) : (
                "一键优化"
              )}
            </button>
          )}
          </div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 12 }}>
            从开头吸引力、结构逻辑、内容质量、表达节奏、格式规范五个维度评估文章质量，
            每个维度附带具体优化建议。评估结果可永久保存在文章中。
          </p>
                    {error && (
            <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 4, fontSize: 12, color: "#cf222e", background: "rgba(207,34,46,0.08)", border: "1px solid rgba(207,34,46,0.2)", lineHeight: 1.5 }}>
              ❌ {error}
            </div>
          )}
          <button className="agent-chat__action agent-chat__action--confirm" onClick={handleReview} disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={12} className="agent-chat__spinner" style={{ marginRight: 4 }} />
                评估中（需消耗约 2000 token）…
              </>
            ) : (
              "开始评估"
            )}
          </button>
        </div>
      )}
    </div>
  );
}
