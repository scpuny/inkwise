import { useState, useRef, useEffect } from "react";
import { Sparkles, SquarePen, PenLine, ArrowRight, Check, Loader2, FileText, CheckCircle2, Clock, AlertCircle, FolderInput, ChevronDown, ChevronRight } from "lucide-react";
import { CustomSelect, type CustomSelectOption } from "../common/CustomSelect";
import type { PlanInput, PlanStep, PartialPlan } from "../../lib/ai/plan";
import { getAllBuiltinSkills, type WritingSkill, getAllSkills } from "../../lib/ai/writingSkill";
import type { OutlineSection } from "../../lib/ai/articleBlueprint";
import type { ToolEvent } from "../../lib/ai/agentEngine";

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
  streamingContent?: string;
  toolEvents?: ToolEvent[];
}

function skillLabel(id: string): string {
  const all = _allSkills.length > 0 ? _allSkills : BUILTIN_SKILLS;
  return all.find(s => s.id === id)?.name || id;
}

export function StartupSplash({
  onQuickStart, onAIPlan,
  planState, planStep, partialPlan, planError, lastPlanInput,
  writingOutline, writingSectionId, streamingContent = "",
  onConfirm, onCancel, onCancelPlan, onEditTitle, onEditDescription, onEditOutline, onRetry, onEnterEditor,
  projectName, projectReady, projectFiles, toolEvents = [],
}: StartupSplashProps) {
  const [inspiration, setInspiration] = useState("");
  const [skillId, setSkillId] = useState("");
  const [audience, setAudience] = useState("");
  const [customAudience, setCustomAudience] = useState("");
const [tone, setTone] = useState("");
const [customTone, setCustomTone] = useState("");
  const [wordCount, setWordCount] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [toolEventsCollapsed, setToolEventsCollapsed] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const responseEndRef = useRef<HTMLDivElement>(null);
  const toolScrollRef = useRef<HTMLDivElement>(null);

  // Auto-expand and auto-scroll when new tool events arrive during writing
  useEffect(() => {
    if (planState === "writing" && toolEvents.length > 0) {
      setToolEventsCollapsed(false);
    }
    if (toolScrollRef.current) {
      toolScrollRef.current.scrollTop = toolScrollRef.current.scrollHeight;
    }
  }, [toolEvents, planState]);

  useEffect(() => { ensureSkills(); }, []);

  // Use a stable scroll key derived from plan data (safe if partialPlan is undefined)
  const scrollKey = planStep + (partialPlan?.title || '') + (partialPlan?.description || '') + (partialPlan?.outline?.length || 0) + (partialPlan?.tags?.length || 0);
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
  const showResponse = planState === "planning" || planState === "review" || planState === "writing" || planState === "article-review";
  // ─── Process tool events into displayable items ───
  interface ToolEventItem {
    type: "pending" | "done" | "error";
    event: ToolEvent;
  }

  const toolEventItems = (() => {
    const items: ToolEventItem[] = [];
    for (const ev of toolEvents) {
      if (ev.type === "tool_start") {
        items.push({ type: "pending", event: ev });
      } else if (ev.type === "tool_end") {
        // Find and mark the corresponding start as done
        let found = false;
        for (let i = items.length - 1; i >= 0; i--) {
          if (items[i].type === "pending" && items[i].event.toolCallId === ev.toolCallId) {
            items[i] = { type: "done", event: ev };
            found = true;
            break;
          }
        }
        if (!found) {
          items.push({ type: "done", event: ev });
        }
      } else if (ev.type === "error") {
        items.push({ type: "error", event: ev });
      }
    }
    return items;
  })();

  const hasToolEvents = toolEventItems.length > 0;
  const pendingCount = toolEventItems.filter(i => i.type === "pending").length;
  const doneCount = toolEventItems.length - pendingCount;

  function renderToolEventItem(item: ToolEventItem, idx: number) {
    const ev = item.event;
    const isPending = item.type === "pending";
    const isError = item.type === "error";
    return (
      <div key={ev.toolCallId + "_" + idx} className={"startup-splash__tool-event-item startup-splash__tool-event-item--" + item.type}>
        <span className="startup-splash__tool-event-item-icon">
          {isPending ? <Loader2 size={13} className="startup-splash__spinner" /> :
           isError ? <AlertCircle size={13} /> :
           <Check size={13} />}
        </span>
        <span className="startup-splash__tool-event-item-label">
          {ev.summary || (isPending ? "执行中…" : isError ? (ev.summary || "错误") : "完成")}
        </span>
      </div>
    );
  }

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

              {/* 工具调用进度（写作阶段） */}
              {planState === "writing" && hasToolEvents && (
                <div className={"startup-splash__tool-events-card" + (toolEventsCollapsed ? " startup-splash__tool-events-card--collapsed" : "")}>
                  <div className="startup-splash__tool-events-card-header"
                    onClick={() => setToolEventsCollapsed(v => !v)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setToolEventsCollapsed(v => !v); } }}
                  >
                    <div className="startup-splash__tool-events-card-title">
                      <FolderInput size={12} />
                      项目文件读取
                      <span className={"startup-splash__tool-events-card-badge" + (pendingCount > 0 ? " startup-splash__tool-events-card-badge--active" : "")}>
                        {doneCount}/{toolEventItems.length}
                      </span>
                    </div>
                    <span className="startup-splash__tool-events-card-toggle">
                      {toolEventsCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                    </span>
                  </div>
                  <div className={"startup-splash__tool-events-card-body" + (toolEventsCollapsed ? "" : "")}>
                    {!toolEventsCollapsed && (
                      <div ref={toolScrollRef}>
                        {toolEventItems.length === 0 ? (
                          <div className="startup-splash__tool-events-empty">等待工具调用…</div>
                        ) : (
                          toolEventItems.map((item, i) => renderToolEventItem(item, i))
                        )}
                        {pendingCount > 0 && (
                          <div className="startup-splash__tool-events-card-status">
                            <Loader2 size={11} className="startup-splash__spinner" />
                            {pendingCount} 个任务执行中…
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Collapsed summary bar */}
                  {toolEventsCollapsed && pendingCount > 0 && (
                    <div className="startup-splash__tool-events-card-summary">
                      <Loader2 size={10} className="startup-splash__spinner" />
                      {pendingCount} 个任务执行中
                    </div>
                  )}
                  {toolEventsCollapsed && pendingCount === 0 && toolEventItems.length > 0 && (
                    <div className="startup-splash__tool-events-card-summary startup-splash__tool-events-card-summary--done">
                      <Check size={10} />
                      全部完成（{doneCount} 个任务）
                    </div>
                  )}
                </div>
              )}

              {/* AI 写内容阶段指示卡 */}
              {planState === "writing" && streamingContent && (
                <div className="startup-splash__writing-card">
                  <span className="startup-splash__writing-card-icon">
                    <PenLine size={14} />
                  </span>
                  <div className="startup-splash__writing-card-content">
                    <div className="startup-splash__writing-card-title">AI 正在写内容…</div>
                    <div className="startup-splash__writing-card-subtitle">基于已读取的项目文件，生成文章正文</div>
                  </div>
                </div>
              )}

              {/* Live streaming content preview */}
              {streamingContent && (
                <div className="startup-splash__section">
                  <div className="startup-splash__section-label">
                    <FileText size={12} />
                    实时生成内容
                  </div>
                  <div className="startup-splash__stream-content">
                    {streamingContent}
                    <span className="startup-splash__stream-cursor">|</span>
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
                  {/* 工具调用进度 */}
                  {hasToolEvents && (
                    <div className={"startup-splash__tool-events-card" + (toolEventsCollapsed ? " startup-splash__tool-events-card--collapsed" : "")}>
                      <div className="startup-splash__tool-events-card-header"
                        onClick={() => setToolEventsCollapsed(v => !v)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setToolEventsCollapsed(v => !v); } }}
                      >
                        <div className="startup-splash__tool-events-card-title">
                          <FolderInput size={12} />
                          项目文件读取
                          <span className={"startup-splash__tool-events-card-badge" + (pendingCount > 0 ? " startup-splash__tool-events-card-badge--active" : "")}>
                            {doneCount}/{toolEventItems.length}
                          </span>
                        </div>
                        <span className="startup-splash__tool-events-card-toggle">
                          {toolEventsCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                        </span>
                      </div>
                      <div className={"startup-splash__tool-events-card-body" + (toolEventsCollapsed ? "" : "")}>
                        {!toolEventsCollapsed && (
                          <div ref={toolScrollRef}>
                            {toolEventItems.length === 0 ? (
                              <div className="startup-splash__tool-events-empty">等待工具调用…</div>
                            ) : (
                              toolEventItems.map((item, i) => renderToolEventItem(item, i))
                            )}
                            {pendingCount > 0 && (
                              <div className="startup-splash__tool-events-card-status">
                                <Loader2 size={11} className="startup-splash__spinner" />
                                {pendingCount} 个任务执行中…
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Collapsed summary bar */}
                      {toolEventsCollapsed && pendingCount > 0 && (
                        <div className="startup-splash__tool-events-card-summary">
                          <Loader2 size={10} className="startup-splash__spinner" />
                          {pendingCount} 个任务执行中
                        </div>
                      )}
                      {toolEventsCollapsed && pendingCount === 0 && toolEventItems.length > 0 && (
                        <div className="startup-splash__tool-events-card-summary startup-splash__tool-events-card-summary--done">
                          <Check size={10} />
                          全部完成（{doneCount} 个任务）
                        </div>
                      )}
                    </div>
                  )}
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
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
                  onFocus={() => setShowSuggestions(false)}
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
  );
}
