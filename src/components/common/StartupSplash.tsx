import { useState, useRef, useEffect } from "react";
import { Sparkles, SquarePen, PenLine, ArrowRight, Check, Loader2, FileText, CheckCircle2, Clock, AlertCircle, FolderInput } from "lucide-react";
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

  const responseEndRef = useRef<HTMLDivElement>(null);

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
              {planState === "writing" && toolEvents && toolEvents.filter(ev => ev.type !== "thinking_done").length > 0 && (
                <div className="startup-splash__tool-events" style={{marginTop:8, display:"flex", flexDirection:"column", gap:3, fontSize:11, color:"#666", maxHeight:150, overflowY:"auto", background:"#fafafa", borderRadius:6, padding:"6px 4px"}}>
                  <div style={{fontSize:10, fontWeight:600, color:"#999", padding:"0 4px 2px 4px", textTransform:"uppercase", letterSpacing:"0.5px"}}>
                    <FolderInput size={10} style={{marginRight:3, verticalAlign:"middle"}} />
                    项目文件读取
                  </div>
                  {toolEvents.filter(ev => ev.type !== "thinking_done").map((ev, i) => {
                    const isThinking = ev.type === "thinking";
                    const isToolStart = ev.type === "tool_start";
                    const isToolEnd = ev.type === "tool_end";
                    const isError = ev.type === "error";
                    return (
                      <div key={i} className="startup-splash__tool-event" style={{
                        display:"flex", alignItems:"flex-start", gap:6,
                        padding:"2px 6px", borderRadius:4,
                        borderLeft: "2px solid " + (
                          isError ? "#e53935" :
                          isThinking ? "#ff9800" :
                          isToolStart ? "#2196f3" :
                          "#4caf50"
                        )
                      }}>
                        <span style={{flexShrink:0, fontSize:12, lineHeight:"18px"}}>
                          {isThinking ? "🧠" : isToolStart ? "🔍" : isError ? "⚠️" : "✅"}
                        </span>
                        <div style={{flex:1, minWidth:0, fontSize:11, lineHeight:"18px", color:"#555", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap"}}>
                          {ev.summary || (isThinking ? "AI 分析中…" : isToolStart ? "读取中…" : isToolEnd ? "完成" : "")}
                        </div>
                      </div>
                    );
                  })}
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
                  {toolEvents && toolEvents.filter(ev => ev.type !== "thinking_done").length > 0 && (
                    <div className="startup-splash__tool-events" style={{marginTop:12, display:"flex", flexDirection:"column", gap:4, fontSize:12, color:"#555", maxHeight:240, overflowY:"auto", background:"#fafafa", borderRadius:8, padding:"8px 4px"}}>
                      <div style={{fontSize:11, fontWeight:600, color:"#888", padding:"0 4px 4px 4px", textTransform:"uppercase", letterSpacing:"0.5px"}}>
                        <FolderInput size={11} style={{marginRight:4, verticalAlign:"middle"}} />
                        AI 工具调用记录
                      </div>
                      {toolEvents.map((ev, i) => {
                        // Skip thinking_done events (they're just markers)
                        if (ev.type === "thinking_done") return null;
                        const isError = ev.type === "error";
                        const isThinking = ev.type === "thinking";
                        const isToolStart = ev.type === "tool_start";
                        const isToolEnd = ev.type === "tool_end";
                        return (
                          <div key={i} className="startup-splash__tool-event" style={{
                            display:"flex", alignItems:"flex-start", gap:8,
                            padding:"4px 8px", borderRadius:6,
                            background: isError ? "#fff0f0" : isToolStart ? "#f0f6ff" : isThinking ? "#fff8e6" : "transparent",
                            borderLeft: "3px solid " + (
                              isError ? "#e53935" :
                              isThinking ? "#ff9800" :
                              isToolStart ? "#2196f3" :
                              "#4caf50"
                            )
                          }}>
                            {isThinking ? (
                              <span style={{fontSize:16, lineHeight:"16px", flexShrink:0}}>&#x1F9E0;</span>
                            ) : isToolStart ? (
                              <span style={{fontSize:14, lineHeight:"16px", flexShrink:0}}>&#x1F50D;</span>
                            ) : isError ? (
                              <span style={{fontSize:14, lineHeight:"16px", flexShrink:0, color:"#e53935"}}>&#x26A0;</span>
                            ) : (
                              <span style={{fontSize:14, lineHeight:"16px", flexShrink:0, color:"#4caf50"}}>&#x2705;</span>
                            )}
                            <div style={{flex:1, minWidth:0}}>
                              <div style={{fontWeight:500, color:"#333", fontSize:13, display:"flex", alignItems:"center", gap:4}}>
                                <span style={{flex:1}}>
                                  {isThinking ? (ev.summary || "AI 分析中…") :
                                   isToolStart ? (ev.summary || "调用中…") :
                                   isToolEnd ? (ev.summary || "完成") :
                                   isError ? (ev.summary || "错误") :
                                   (ev.summary || "")}
                                </span>
                                {ev.round && (
                                  <span style={{fontSize:10, color:"#aaa", background:"#eee", borderRadius:4, padding:"0 5px"}}>
                                    第{ev.round}轮
                                  </span>
                                )}
                              </div>
                              {ev.result && isToolEnd && (
                                <div style={{fontSize:11, color:"#666", marginTop:2, lineHeight:1.4}}>
                                  {ev.result.slice(0, 200)}
                                </div>
                              )}
                              {isError && ev.result && (
                                <div style={{fontSize:11, color:"#c62828", marginTop:2}}>
                                  {ev.result.slice(0, 200)}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
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
