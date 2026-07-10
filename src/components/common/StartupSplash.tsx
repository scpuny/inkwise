import { useState, useRef, useEffect } from "react";
import { Sparkles, SquarePen, PenLine, ArrowRight, Check, Loader2, FileText, CheckCircle2, AlertCircle, FolderInput, ChevronDown, ChevronRight } from "lucide-react";
import { CustomSelect, type CustomSelectOption } from "../common/CustomSelect";
import type { PlanInput, PlanStep, PartialPlan } from "../../lib/ai/plan";
import { getAllBuiltinSkills, type WritingSkill, getAllSkills } from "../../lib/ai/writingSkill";
import type { OutlineSection } from "../../lib/ai/article/blueprint";
import type { ToolEvent } from "../../lib/ai/agent/engine";
import { markdownToHtml } from "../../lib/markdown/renderer";
import { ProjectFileTree } from "../common/ProjectFileTree";
import type { FileNode } from "../../lib/storage/collections";

const SUGGESTIONS = [
  "写一篇关于秋天午后的散文",
  "帮我写一封正式的商务邮件",
  "React 状态管理的最佳实践",
  "城市夜晚的随笔",
  "产品发布公告文案",
  "用幽默的风格写一篇自我介绍",
];

const AUDIENCE_OPTIONS = [
  { value: "", label: "不限" },
  { value: "大众读者", label: "大众读者" },
  { value: "技术人员", label: "技术人员" },
  { value: "文学爱好者", label: "文学爱好者" },
  { value: "学生", label: "学生" },
  { value: "__custom__", label: "自定义…" },
];

const TONE_OPTIONS = [
  { value: "", label: "不限（AI 自行决定）" },
  { value: "正式", label: "正式" },
  { value: "幽默", label: "幽默" },
  { value: "轻松口语", label: "轻松口语" },
  { value: "热情激昂", label: "热情激昂" },
  { value: "冷静客观", label: "冷静客观" },
  { value: "犀利尖锐", label: "犀利尖锐" },
  { value: "温暖亲和", label: "温暖亲和" },
  { value: "__custom__", label: "自定义…" },
];

const BUILTIN_SKILLS = getAllBuiltinSkills();

// 技能列表懒加载（含自定义）
let _allSkills: WritingSkill[] = [];
let _skillsLoaded = false;

async function ensureSkills() {
  if (!_skillsLoaded) {
    try {
      _allSkills = await getAllSkills();
    } catch {
      _allSkills = BUILTIN_SKILLS;
    }
    _skillsLoaded = true;
  }
}

interface StartupSplashProps {
  onQuickStart: () => void;
  onAIPlan: (input: PlanInput) => void;
  onContinueToOutline?: () => void;
  planState: "idle" | "planning" | "review" | "review-title-desc" | "writing" | "article-review";
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
  projectStructure?: FileNode[];
  streamingContent?: string;
  toolEvents?: ToolEvent[];
}

function skillLabel(id: string): string {
  const all = _allSkills.length > 0 ? _allSkills : BUILTIN_SKILLS;
  return all.find(s => s.id === id)?.name || id;
}

export function StartupSplash({
  onQuickStart, onAIPlan, onContinueToOutline,
  planState, planStep, partialPlan, planError, lastPlanInput,
  writingOutline, writingSectionId, streamingContent = "",
  onConfirm, onCancel, onCancelPlan, onEditTitle, onEditDescription, onEditOutline, onRetry, onEnterEditor,
  projectName, projectReady, projectFiles, projectStructure, toolEvents = [],
}: StartupSplashProps) {
  const [inspiration, setInspiration] = useState("");
  const [skillId, setSkillId] = useState("");
  const [audience, setAudience] = useState("");
  const [customAudience, setCustomAudience] = useState("");
  const [tone, setTone] = useState("");
  const [customTone, setCustomTone] = useState("");
  const [wordCount, setWordCount] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  // toolEventsCollapsed removed — replaced with inline progress bar
  const [showOnboarding, setShowOnboarding] = useState(false);

  const responseEndRef = useRef<HTMLDivElement>(null);
  // toolScrollRef removed

  // Refs for auto-scrolling
  const streamContentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll streaming content
  useEffect(() => {
    if (streamContentRef.current) {
      streamContentRef.current.scrollTop = streamContentRef.current.scrollHeight;
    }
  }, [streamingContent]);

  /* tool events auto-expand removed — replaced with inline progress bar */

  useEffect(() => { ensureSkills(); }, []);

  // Use a stable scroll key derived from plan data + streaming content + tool events
  const scrollKey = planStep + (partialPlan?.title || '') + (partialPlan?.description || '') + (partialPlan?.outline?.length || 0) + (partialPlan?.tags?.length || 0) + (streamingContent ? streamingContent.length : 0) + toolEvents.length;
  useEffect(() => {
    responseEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [scrollKey]);

  const handlePlan = () => {
    if (!inspiration.trim()) return;
    setShowSuggestions(false);
    const skill = skillId ? _allSkills.find(s => s.id === skillId) : undefined;
    onAIPlan({
      inspiration: inspiration.trim(),
      skillId: skillId || undefined,
      tone: tone === "__custom__" ? customTone.trim() : (tone || undefined),
      targetAudience: audience === "__custom__" ? customAudience.trim() : (audience || undefined),
      targetWordCount: wordCount ? parseInt(wordCount) : undefined,
    });
  };

  const isGenerating = planState === "planning" || planState === "writing";
  const showResponse = planState === "planning" || planState === "review" || planState === "review-title-desc" || planState === "writing" || planState === "article-review";
  // ─── Process tool events into displayable items ───
  interface ToolEventItem {
    type: "pending" | "done" | "error" | "thinking" | "thinking_done";
    event: ToolEvent;
  }

  const toolEventItems = (() => {
    const items: ToolEventItem[] = [];
    for (const ev of toolEvents) {
      if (ev.type === "tool_start") {
        items.push({ type: "pending", event: ev });
      } else if (ev.type === "tool_end") {
        let found = false;
        for (let i = items.length - 1; i >= 0; i--) {
          if (items[i].type === "pending" && items[i].event.toolCallId === ev.toolCallId) {
            items[i] = { type: "done", event: ev };
            found = true;
            break;
          }
        }
        if (!found) items.push({ type: "done", event: ev });
      } else if (ev.type === "error") {
        items.push({ type: "error", event: ev });
      } else if (ev.type === "thinking") {
        items.push({ type: "thinking", event: ev });
      } else if (ev.type === "thinking_done") {
        items.push({ type: "thinking_done", event: ev });
      }
    }
    return items;
  })();

  const doneCount = toolEventItems.filter(i => i.type === "done").length;

  // Current operation description for writing phase
  const currentToolOp = (() => {
    // Find the most recent pending (in-progress) tool event
    const pending = toolEventItems.filter(i => i.type === "pending");
    if (pending.length > 0) {
      const last = pending[pending.length - 1];
      const s = last.event.summary || "";
      // Shorten verbose summaries
      return s.length > 60 ? s.slice(0, 57) + "…" : s;
    }
    // Or show the latest thinking
    const thinking = toolEventItems.filter(i => i.type === "thinking");
    if (thinking.length > 0) {
      const last = thinking[thinking.length - 1];
      if (last.event.summary && last.event.summary !== "AI 分析完成") {
        return last.event.summary;
      }
    }
    return "";
  })();

  const pendingCount = toolEventItems.filter(i => i.type === "pending").length;

  /* parseToolArgs removed */

  /* renderToolEventItem removed */

  // Guard against undefined partialPlan
  const safePlan = partialPlan || { title: '', description: '', outline: [], tags: [], tone: '', targetAudience: '', targetWordCount: 0 };
  const hasTitle = !!safePlan.title;
  const hasDescription = !!safePlan.description;
  const hasOutline = safePlan.outline.length > 0;
  const hasTags = safePlan.tags.length > 0;

  return (
    <div className="startup-splash">
      {/* 左侧：关联项目信息 */}
      {projectName ? (
        <aside className="startup-splash__sidebar">
          <div className="startup-splash__sidebar-header">
            <FolderInput size={14} />
            <span>关联项目</span>
          </div>
          <div className="startup-splash__project-info">
            <div className="startup-splash__project-name">{projectName}</div>
            <div className="startup-splash__flex">
              {projectFiles && projectFiles.length > 0 && (
                <div className="startup-splash__project-stats">
                  <span>{projectFiles.length} 个文件</span>
                </div>
              )}
              <div className="startup-splash__project-status">
                <span className={`startup-splash__status-dot ${projectReady ? 'startup-splash__status-dot--ready' : ''}`} />
                <span>{projectReady ? '已就绪' : '分析中'}</span>
              </div>
            </div>
          </div>
          {projectStructure && projectStructure.length > 0 && (
            <div className="startup-splash__project-tree">
              <div className="startup-splash__project-tree-header">
                <FolderInput size={11} />
                <span>目录结构</span>
              </div>
              <div className="startup-splash__project-tree-content">
                <ProjectFileTree nodes={projectStructure} maxDepth={4} onSelect={() => { }} />
              </div>
            </div>
          )}
        </aside>
      ) : null}
      <div className="startup-splash__main">
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
                      {lastPlanInput.tone && <span>风格: {lastPlanInput.tone}</span>}{lastPlanInput.skillId && !lastPlanInput.tone && <span>技能: {skillLabel(lastPlanInput.skillId)}</span>}
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
                      {(() => {
                        const counters: number[] = [0, 0, 0];
                        let lastLevel = 1;
                        return safePlan.outline.map((sec, i) => {
                          const lvl = sec.level;
                          // Reset lower counters
                          if (lvl < lastLevel) {
                            for (let j = lvl; j < counters.length; j++) counters[j] = 0;
                          }
                          counters[lvl - 1]++;
                          lastLevel = lvl;
                          // Build prefix like "1." or "1.1" or "1.1.1"
                          const prefix = counters.slice(0, lvl).join(".");
                          return (
                            <li key={sec.id || i} style={{ marginLeft: `${(lvl - 1) * 20}px` }}
                              className="startup-splash__outline-item">
                              <span className="startup-splash__outline-item-title">
                                <span className="startup-splash__outline-num">{prefix}.</span>
                                {sec.title}
                              </span>
                              {sec.description && <span className="startup-splash__outline-desc">{sec.description}</span>}
                            </li>
                          );
                        });
                      })()}
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
                    <button className="btn" onClick={onCancelPlan} style={{ fontSize: 11, height: 24, padding: '0 8px' }}>
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

                {/* Actions: title+desc review (new document) */}
                {planState === "review-title-desc" && (
                  <div className="startup-splash__actions">
                    <button className="btn btn--primary" style={{ height: 30 }} onClick={onContinueToOutline}>
                      <Sparkles size={14} /> 继续生成大纲
                    </button>
                    <button className="btn" onClick={onCancel}>
                      返回修改需求
                    </button>
                  </div>
                )}

                {/* Actions: full review */}
                {planState === "review" && (
                  <div className="startup-splash__actions">
                    <button className="btn btn--primary" style={{ height: 30 }} onClick={onConfirm}>
                      <Sparkles size={14} /> 确认并开始写作
                    </button>
                    <button className="btn" onClick={onCancel}>
                      返回修改需求
                    </button>
                  </div>
                )}

                {/* Live streaming content preview */}
                {(planState === "writing" || streamingContent) && (
                  <div className="startup-splash__section startup-splash__section--writing">
                    <div className="startup-splash__section-label">
                      <PenLine size={12} className={planState === "writing" ? "startup-splash__spinner" : ""} />
                      {planState === "writing" ? "AI 正在生成文章…" : "生成内容预览"}
                    </div>
                    {/* Compact tool progress during writing */}
                    {planState === "writing" && toolEventItems.length > 0 && (
                      <div className="startup-splash__tool-progress">
                        <div className="startup-splash__tool-progress-bar">
                          <div
                            className="startup-splash__tool-progress-fill"
                            style={{ width: Math.min(100, (toolEventItems.length > 0 ? (doneCount / toolEventItems.length) * 100 : 0)) + "%" }}
                          />
                        </div>
                        <span className="startup-splash__tool-progress-label">
                          {pendingCount > 0 && currentToolOp ? (
                            <><Loader2 size={10} className="startup-splash__spinner" /> {currentToolOp}</>
                          ) : (
                            <><Check size={10} style={{ color: 'var(--accent)' }} /> 已完成 {doneCount} 项操作</>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="startup-splash__stream-content" ref={streamContentRef}>
                      {streamingContent ? (
                        <>
                          <div className="startup-splash__stream-markdown" dangerouslySetInnerHTML={{ __html: markdownToHtml(streamingContent) }} />
                          <span className="startup-splash__stream-cursor">|</span>
                        </>
                      ) : (
                        <div className="startup-splash__stream-placeholder">
                          <Loader2 size={14} className="startup-splash__spinner" />
                          <span>正在准备生成内容…</span>
                        </div>
                      )}
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
                    {/* 工具调用进度（简略版） */}
                    {toolEventItems.length > 0 && (
                      <div className="startup-splash__review-tool-summary">
                        <Check size={11} />
                        <span>AI 在工作过程中读取了 {doneCount} 个文件</span>
                      </div>
                    )}                  {planError && (
                      <div className="startup-splash__error" style={{ marginTop: 12 }}>
                        <AlertCircle size={12} />
                        <span>{planError}</span>
                      </div>
                    )}
                    <div className="startup-splash__actions" style={{ marginTop: 16 }}>
                      <button className="btn btn--primary" style={{ height: 30 }} onClick={onEnterEditor}>
                        <img src="/inkwise-icon.svg" width="16" height="16" alt="" style={{ verticalAlign: "middle", marginRight: 4 }} /> 进入编辑
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

              {/* Onboarding toggle */}
              <button className="startup-splash__onboarding-btn" onClick={() => setShowOnboarding(true)}>
                新手引导
              </button>

              {/* Onboarding overlay */}
              {showOnboarding && (
                <div className="startup-splash__onboarding-overlay" onClick={() => setShowOnboarding(false)}>
                  <div className="startup-splash__onboarding" onClick={e => e.stopPropagation()}>
                    <div className="startup-splash__onboarding-header">
                      InkWise 新手引导
                      <button className="startup-splash__onboarding-close" onClick={() => setShowOnboarding(false)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      </button>
                    </div>
                    <div className="startup-splash__onboarding-steps">
                      <div className="startup-splash__onboarding-step">
                        <span className="startup-splash__onboarding-step-num">1</span>
                        <div className="startup-splash__onboarding-step-content">
                          <strong>输入灵感</strong>
                          <p>输入一个主题或一句话，AI 会帮你规划文章大纲</p>
                        </div>
                      </div>
                      <div className="startup-splash__onboarding-step">
                        <span className="startup-splash__onboarding-step-num">2</span>
                        <div className="startup-splash__onboarding-step-content">
                          <strong>AI 规划</strong>
                          <p>AI 自动生成标题、简介、大纲和标签，你可以在确认前编辑</p>
                        </div>
                      </div>
                      <div className="startup-splash__onboarding-step">
                        <span className="startup-splash__onboarding-step-num">3</span>
                        <div className="startup-splash__onboarding-step-content">
                          <strong>写作与审阅</strong>
                          <p>在富文本编辑器中写作，完成后让 AI 审阅并优化</p>
                        </div>
                      </div>
                      <div className="startup-splash__onboarding-step">
                        <span className="startup-splash__onboarding-step-num">4</span>
                        <div className="startup-splash__onboarding-step-content">
                          <strong>发布</strong>
                          <p>文章定稿后，可一键导出或发布到各平台</p>
                        </div>
                      </div>
                    </div>
                    <div className="startup-splash__onboarding-shortcuts">
                      <div className="startup-splash__onboarding-shortcuts-title">常用快捷键</div>
                      <div className="startup-splash__onboarding-shortcuts-grid">
                        <span><kbd>⌘</kbd><kbd>⏎</kbd> AI 规划</span>
                        <span><kbd>⌘</kbd><kbd>B</kbd> 加粗</span>
                        <span><kbd>⌘</kbd><kbd>I</kbd> 斜体</span>
                        <span><kbd>⌘</kbd><kbd>K</kbd> 插入链接</span>
                        <span><kbd>⌘</kbd><kbd>Z</kbd> 撤销</span>
                        <span><kbd>⌘</kbd><kbd>⇧</kbd><kbd>Z</kbd> 重做</span>
                        <span><kbd>⌘</kbd><kbd>\</kbd> 侧边栏</span>
                        <span><kbd>⌘</kbd><kbd>⇧</kbd><kbd>\</kbd> Agent</span>
                      </div>
                    </div>
                    <div className="startup-splash__onboarding-footer">
                      <button className="btn btn--primary" onClick={() => setShowOnboarding(false)}>知道了</button>
                    </div>
                  </div>
                </div>
              )}

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
                  autoFocus
                />
              </div>

              <div className="startup-splash__options-bar">
                <CustomSelect
                  value={skillId}
                  onChange={setSkillId}
                  placeholder="写作风格"
                  options={(_allSkills.length > 0 ? _allSkills : BUILTIN_SKILLS).map(s => ({ value: s.id, label: `${s.icon} ${s.name}` }))}
                />
                <div className="startup-splash__option-with-custom">
                  <CustomSelect
                    value={tone}
                    onChange={setTone}
                    placeholder="文章语气"
                    options={TONE_OPTIONS}
                  />
                  {tone === "__custom__" && (
                    <input className="startup-splash__option-input" placeholder="输入语气" value={customTone}
                      onChange={(e) => setCustomTone(e.target.value)} />
                  )}
                </div>
                <div className="startup-splash__option-with-custom">
                  <CustomSelect
                    value={audience}
                    onChange={setAudience}
                    placeholder="目标读者"
                    options={AUDIENCE_OPTIONS}
                  />
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
    </div>
  );
}
