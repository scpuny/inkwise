import { useState, useRef, useEffect } from "react";
import { Sparkles, SquarePen, PenLine, ArrowRight, Check, Loader2, FileText, CheckCircle2, Clock, AlertCircle, FolderInput } from "lucide-react";
import type { PlanInput, PlanStep, PartialPlan } from "../lib/plan";
import type { OutlineSection } from "../lib/articleBlueprint";

const SUGGESTIONS = [
  "写一篇关于秋天午后的散文",
  "帮我写一封正式的商务邮件",
  "React 状态管理的最佳实践",
  "城市夜晚的随笔",
  "产品发布公告文案",
  "用幽默的风格写一篇自我介绍",
];

const TONE_OPTIONS = [
  { value: "文艺", label: "文艺" },
  { value: "正式", label: "正式" },
  { value: "口语", label: "口语" },
  { value: "学术", label: "学术" },
  { value: "幽默", label: "幽默" },
];

const AUDIENCE_OPTIONS = [
  { value: "", label: "不限" },
  { value: "大众读者", label: "大众读者" },
  { value: "技术人员", label: "技术人员" },
  { value: "文学爱好者", label: "文学爱好者" },
  { value: "学生", label: "学生" },
  { value: "__custom__", label: "自定义…" },
];

interface StartupSplashProps {
  onQuickStart: () => void;
  onAIPlan: (input: PlanInput) => void;
  planState: "idle" | "planning" | "review" | "writing" | "article-review";
  planStep: PlanStep;
  partialPlan: PartialPlan;
  planError: string | null;
  lastPlanInput: PlanInput | null;
  writingOutline: OutlineSection[];
  writingSectionId: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onCancelPlan?: () => void;
  onEditTitle: (title: string) => void;
  onEditDescription: (desc: string) => void;
  onEditOutline: (outline: OutlineSection[]) => void;
  onRetry: () => void;
  onEnterEditor: () => void;
  projectName?: string;
  projectReady?: boolean;
  projectFiles?: string[];
}

export function StartupSplash({
  onQuickStart, onAIPlan,
  planState, planStep, partialPlan, planError, lastPlanInput,
  writingOutline, writingSectionId,
  onConfirm, onCancel, onCancelPlan, onEditTitle, onEditDescription, onEditOutline, onRetry, onEnterEditor,
  projectName, projectReady, projectFiles,
}: StartupSplashProps) {
  const [inspiration, setInspiration] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [customAudience, setCustomAudience] = useState("");
  const [wordCount, setWordCount] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);

  const responseEndRef = useRef<HTMLDivElement>(null);

  // Use a stable scroll key derived from plan data (safe if partialPlan is undefined)
  const scrollKey = planStep + (partialPlan?.title || '') + (partialPlan?.description || '') + (partialPlan?.outline?.length || 0) + (partialPlan?.tags?.length || 0);
  useEffect(() => {
    responseEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [scrollKey]);

  const handlePlan = () => {
    if (!inspiration.trim()) return;
    setShowSuggestions(false);
    onAIPlan({
      inspiration: inspiration.trim(),
      tone: tone || undefined,
      targetAudience: audience === "__custom__" ? customAudience.trim() : (audience || undefined),
      targetWordCount: wordCount ? parseInt(wordCount) : undefined,
    });
  };

  const isGenerating = planState === "planning" || planState === "writing";
  const showResponse = planState === "planning" || planState === "review" || planState === "writing" || planState === "article-review";
  // Guard against undefined partialPlan
  const safePlan = partialPlan || { title: '', description: '', outline: [], tags: [], tone: '', targetAudience: '', targetWordCount: 0 };
  const hasTitle = !!safePlan.title;
  const hasDescription = !!safePlan.description;
  const hasOutline = safePlan.outline.length > 0;
  const hasTags = safePlan.tags.length > 0;

  return (
    <div className="startup-splash">
      {showResponse ? (
        /* ── Response View (chat-like conversation) ── */
        <div className="startup-splash__response">
          {/* User message */}
          {lastPlanInput && (
            <div className="startup-splash__msg user-msg">
              <div className="startup-splash__msg-avatar">U</div>
              <div className="startup-splash__msg-body">
                <p>{lastPlanInput.inspiration}</p>
                {(lastPlanInput.tone || lastPlanInput.targetAudience || lastPlanInput.targetWordCount) && (
                  <div className="startup-splash__msg-meta">
                    {lastPlanInput.tone && <span>风格: {lastPlanInput.tone}</span>}
                    {lastPlanInput.targetAudience && <span>读者: {lastPlanInput.targetAudience}</span>}
                    {lastPlanInput.targetWordCount && <span>字数: ~{lastPlanInput.targetWordCount}</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI response */}
          <div className="startup-splash__msg ai-msg">
            <div className="startup-splash__msg-avatar ai-avatar">
              <Sparkles size={13} />
            </div>
            <div className="startup-splash__msg-body ai-body">
              {/* Thinking indicator while first step loads */}
              {!hasTitle && isGenerating && (
                <div className="startup-splash__thinking">
                  <Loader2 size={14} className="startup-splash__spinner" />
                  <span>正在分析你的灵感…</span>
                </div>
              )}

              {/* Title */}
              {hasTitle && (
                <div className="startup-splash__section">
                  <div className="startup-splash__section-label">
                    <Check size={12} className="startup-splash__check" />
                    标题
                  </div>
                  <div className="startup-splash__section-value editable" onClick={() => {
                    const v = prompt("编辑标题", safePlan.title);
                    if (v) onEditTitle(v);
                  }}>
                    {safePlan.title}
                  </div>
                </div>
              )}

              {/* Description */}
              {hasDescription && (
                <div className="startup-splash__section">
                  <div className="startup-splash__section-label">
                    <Check size={12} className="startup-splash__check" />
                    简介
                  </div>
                  <div className="startup-splash__section-value editable" onClick={() => {
                    const v = prompt("编辑简介", safePlan.description);
                    if (v) onEditDescription(v);
                  }}>
                    {safePlan.description}
                  </div>
                </div>
              )}

              {/* Outline */}
              {hasOutline && (
                <div className="startup-splash__section">
                  <div className="startup-splash__section-label">
                    <Check size={12} className="startup-splash__check" />
                    大纲
                  </div>
                  <ol className="startup-splash__outline">
                    {safePlan.outline.map((sec, i) => (
                      <li key={sec.id || i} style={{ marginLeft: `${(sec.level - 1) * 16}px` }}>
                        {sec.title}
                        {sec.description && <span className="startup-splash__outline-desc"> — {sec.description}</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Tags */}
              {hasTags && (
                <div className="startup-splash__section">
                  <div className="startup-splash__section-label">
                    <Check size={12} className="startup-splash__check" />
                    标签
                  </div>
                  <div className="startup-splash__tags">
                    {safePlan.tags.map((tag, i) => (
                      <span key={i} className="startup-splash__tag">{tag}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cancel button during planning */}
              {isGenerating && (
                <div className="startup-splash__cancel-row">
                  <button className="btn" onClick={onCancelPlan} style={{fontSize: 11, height: 24, padding: '0 8px'}}>
                    取消规划
                  </button>
                </div>
              )}

              {/* Step loading indicator */}
              {isGenerating && hasTitle && (
                <div className="startup-splash__thinking startup-splash__thinking--next">
                  <Loader2 size={13} className="startup-splash__spinner" />
                  <span>
                    {planStep === "description" && !hasDescription ? "正在撰写简介…" :
                     planStep === "outline" && !hasOutline ? "正在规划大纲…" :
                     planStep === "tags" && !hasTags ? "正在生成标签…" :
                     "处理中…"}
                  </span>
                </div>
              )}

              {/* Error */}
              {planError && (
                <div className="startup-splash__error">
                  <span>{planError}</span>
                  <button className="btn btn--small" onClick={onRetry}>重试</button>
                </div>
              )}

              {/* Actions */}
              {planState === "review" && (
                <div className="startup-splash__actions">
                  <button className="btn btn--primary" style={{height:30}} onClick={onConfirm}>
                    <Sparkles size={14} /> 确认并开始写作
                  </button>
                  <button className="btn" onClick={onCancel}>
                    返回修改需求
                  </button>
                </div>
              )}

              {/* Writing progress */}
              {planState === "writing" && writingOutline.length > 0 && (
                <div className="startup-splash__section">
                  <div className="startup-splash__section-label">
                    <Loader2 size={12} className="startup-splash__spinner" />
                    正在生成文章…{writingOutline.filter(s => s.status === "complete").length}/{writingOutline.length} 节完成
                  </div>
                  <div className="startup-splash__writing-list">
                    {writingOutline.map((s) => {
                      const isCurrent = s.id === writingSectionId;
                      const isDone = s.status === "complete";
                      const isWriting = s.status === "writing" && isCurrent;
                      return (
                        <div
                          key={s.id}
                          className={`startup-splash__writing-item${isCurrent ? " startup-splash__writing-item--current" : ""}${isDone ? " startup-splash__writing-item--done" : ""}`}
                        >
                          {isDone ? (
                            <CheckCircle2 size={14} className="startup-splash__writing-icon-done" />
                          ) : isWriting ? (
                            <Loader2 size={14} className="startup-splash__spinner" />
                          ) : (
                            <Clock size={14} className="startup-splash__writing-icon-pending" />
                          )}
                          <span className="startup-splash__writing-title">{s.title}</span>
                          {s.description && (
                            <span className="startup-splash__writing-desc">{s.description}</span>
                          )}
                          {isWriting && <span className="startup-splash__writing-badge">写作中…</span>}
                          {isDone && <span className="startup-splash__writing-badge startup-splash__writing-badge--done">已完成</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Article review */}
              {planState === "article-review" && (
                <div className="startup-splash__section">
                  <div className="startup-splash__section-label">
                    <Check size={12} className="startup-splash__check" />
                    文章已生成，请审阅
                  </div>
                  <div className="startup-splash__review-summary">
                    <div className="startup-splash__review-stat">
                      <FileText size={14} />
                      <span>{partialPlan.title || "无标题"}</span>
                    </div>
                    <div className="startup-splash__review-stat">
                      <span>{writingOutline.length} 个章节 · 全部完成</span>
                    </div>
                  </div>
                  <div className="startup-splash__writing-list">
                    {writingOutline.map((s) => (
                      <div key={s.id} className="startup-splash__writing-item startup-splash__writing-item--done">
                        <CheckCircle2 size={14} className="startup-splash__writing-icon-done" />
                        <span className="startup-splash__writing-title">{s.title}</span>
                        {s.description && <span className="startup-splash__writing-desc">{s.description}</span>}
                      </div>
                    ))}
                  </div>
                  {planError && (
                    <div className="startup-splash__error" style={{marginTop:12}}>
                      <AlertCircle size={12} />
                      <span>{planError}</span>
                    </div>
                  )}
                  <div className="startup-splash__actions" style={{marginTop:16}}>
                    <button className="btn btn--primary" style={{height:30}} onClick={onEnterEditor}>
                      <img src="/inkwise-icon.svg" width="16" height="16" alt="" style={{verticalAlign:"middle",marginRight:4}} /> 进入编辑
                    </button>
                    <button className="btn" onClick={onCancel}>
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div ref={responseEndRef} />
        </div>
      ) : (
        /* ── Input View (welcome) ── */
        <>
          
            <>
              <div className="startup-splash__brand">
                <img src="/inkwise-icon.svg" width="80" height="80" alt="InkWise" className="startup-splash__logo" />
                <h1>开始写作</h1>
                <p className="startup-splash__tagline">输入灵感，AI 帮你完成从规划到成文的全部工作</p>
              </div>

              {showSuggestions && inspiration.length === 0 && (
                <div className="startup-splash__suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} className="startup-splash__suggestion-chip"
                      onClick={() => { setInspiration(s); setShowSuggestions(false); }}>
                      <Sparkles size={10} /> {s}
                    </button>
                  ))}
                </div>
              )}

              <div className="startup-splash__input-area">
                <textarea className="startup-splash__input" placeholder="你想写什么？输入一个主题、一句话或一段描述…"
                  rows={3} value={inspiration}
                  onChange={(e) => setInspiration(e.target.value)}
                  onFocus={() => setShowSuggestions(false)}
                  autoFocus
                />
              </div>

              <div className="startup-splash__options-bar">
                <select className="startup-splash__option-select" value={tone} onChange={(e) => setTone(e.target.value)}>
                  <option value="">写作风格</option>
                  {TONE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                </select>

                <div className="startup-splash__option-with-custom">
                  <select className="startup-splash__option-select" value={audience} onChange={(e) => setAudience(e.target.value)}>
                    <option value="">目标读者</option>
                    {AUDIENCE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
                  </select>
                  {audience === "__custom__" && (
                    <input className="startup-splash__option-input" placeholder="输入读者" value={customAudience}
                      onChange={(e) => setCustomAudience(e.target.value)} />
                  )}
                </div>

                <input className="startup-splash__option-input startup-splash__option-input--short" type="number"
                  placeholder="字数" min={100} max={100000} value={wordCount} onChange={(e) => setWordCount(e.target.value)} />

                <div className="startup-splash__action-group">
                  <button className="btn btn--primary"
                    disabled={!inspiration.trim()} onClick={handlePlan}>
                    <Sparkles size={14} /> AI 规划
                  </button>
                  <button className="btn" onClick={onQuickStart}>
                    <SquarePen size={14} /> 快速开始
                  </button>
                </div>
              </div>
              <p className="startup-splash__hint">
                <ArrowRight size={11} /> 按 <kbd>⌘</kbd><kbd>⏎</kbd> 使用 AI 规划
              </p>
            </>
        </>
      )}
    </div>
  );
}
