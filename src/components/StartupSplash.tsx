import { useState } from "react";
import { Sparkles, SquarePen, PenLine, ArrowRight } from "lucide-react";
import type { PlanInput } from "../lib/plan";

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

export function StartupSplash({ onQuickStart, onAIPlan, planning }: {
  onQuickStart: () => void;
  onAIPlan: (input: PlanInput) => void;
  planning?: boolean;
}) {
  const [inspiration, setInspiration] = useState("");
  const [tone, setTone] = useState("");
  const [audience, setAudience] = useState("");
  const [customAudience, setCustomAudience] = useState("");
  const [wordCount, setWordCount] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(true);

  const handlePlan = () => {
    if (!inspiration.trim()) return;
    onAIPlan({
      inspiration: inspiration.trim(),
      tone: tone || undefined,
      targetAudience: audience === "__custom__" ? customAudience.trim() : (audience || undefined),
      targetWordCount: wordCount ? parseInt(wordCount) : undefined,
    });
  };

  return (
    <div className="startup-splash">
      {/* Brand */}
      <div className="startup-splash__brand">
        <PenLine size={22} strokeWidth={1.5} />
        <h1>开始写作</h1>
        <p className="startup-splash__tagline">输入灵感，AI 帮你完成从规划到成文的全部工作</p>
      </div>

      {/* Suggestion chips — above input */}
      {showSuggestions && inspiration.length === 0 && (
        <div className="startup-splash__suggestions">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="startup-splash__suggestion-chip"
              onClick={() => { setInspiration(s); setShowSuggestions(false); }}
            >
              <Sparkles size={10} />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="startup-splash__input-area">
        <textarea
          className="startup-splash__input"
          placeholder="你想写什么？输入一个主题、一句话或一段描述…"
          rows={3}
          value={inspiration}
          onChange={(e) => setInspiration(e.target.value)}
          onFocus={() => setShowSuggestions(false)}
          autoFocus
        />
      </div>

      {/* Options bar */}
      <div className="startup-splash__options-bar">
        <select
          className="startup-splash__option-select"
          value={tone}
          onChange={(e) => setTone(e.target.value)}
        >
          <option value="">写作风格</option>
          {TONE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <div className="startup-splash__option-with-custom">
          <select
            className="startup-splash__option-select"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          >
            <option value="">目标读者</option>
            {AUDIENCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {audience === "__custom__" && (
            <input
              className="startup-splash__option-input"
              placeholder="输入读者"
              value={customAudience}
              onChange={(e) => setCustomAudience(e.target.value)}
            />
          )}
        </div>

        <input
          className="startup-splash__option-input startup-splash__option-input--short"
          type="number"
          placeholder="字数"
          min={100}
          max={100000}
          value={wordCount}
          onChange={(e) => setWordCount(e.target.value)}
        />

        <div className="startup-splash__action-group">
          <button
            className="startup-splash__action-btn startup-splash__action-btn--primary"
            disabled={!inspiration.trim() || planning}
            onClick={handlePlan}
          >
            {planning ? (
              <><span className="startup-splash__spinner" /> 规划中</>
            ) : (
              <><Sparkles size={14} /> AI 规划</>
            )}
          </button>
          <button className="startup-splash__action-btn" onClick={onQuickStart} disabled={planning}>
            <SquarePen size={14} /> 快速开始
          </button>
        </div>
      </div>

      {/* Footer hint */}
      <p className="startup-splash__hint">
        <ArrowRight size={11} />
        按 <kbd>⌘</kbd><kbd>⏎</kbd> 使用 AI 规划
      </p>
    </div>
  );
}
