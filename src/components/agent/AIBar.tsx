import {
  Brain,
  ChevronsUpDown,
  Gauge,
  Image,
  MoreHorizontal,
  Play,
  SendHorizonal,
  Sparkles,
  Type,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emit, on } from "../../lib/events/eventBus";
import { getProvidersSync, getImageModelsSync, type ModelEntry } from "../../lib/storage/providerModels";
import { listSkills, type Skill } from "../../lib/storage/skill";
import { PopoverMenu, type MenuItem } from "../common/PopoverMenu";
import { IntentMenu, type IntentOption } from "./IntentMenu";
import { getAllBuiltinSkills, loadCustomSkills } from "../../lib/ai/writingSkill";
import type { WritingSkill } from "../../lib/ai/writingSkill/types";
import { invokeOrFallback } from "../../lib/bridge/tauri";

const COMPOSER_MIN_HEIGHT = 104;
const COMPOSER_MAX_HEIGHT = 360;

const EFFORTS: MenuItem[] = [
  { id: "auto", label: "自动", subtitle: "由系统决定", onClick: () => {} },
  { id: "low", label: "低", subtitle: "快速响应", onClick: () => {} },
  { id: "medium", label: "中", subtitle: "平衡", onClick: () => {} },
  { id: "high", label: "高", subtitle: "深度思考", onClick: () => {} },
];

const TOKEN_PRESETS = [500, 1000, 2000, 4000, 8000] as const;

export function AIBar({ onSend, sending: externalSending, onIntent }: { onSend?: (text: string) => void; sending?: boolean; onIntent?: (intent: string) => void }) {
  const [value, setValue] = useState("");
  const [localSending, setLocalSending] = useState(false);
  const sending = externalSending ?? localSending;
  const [resizing, setResizing] = useState(false);
  const [composerHeight, setComposerHeight] = useState<number | null>(null);

  // Model list from provider API — sync initializer reads latest from localStorage
  const [modelItems, setModelItems] = useState<MenuItem[]>(() => buildModelItems());
  const [selectedModel, setSelectedModel] = useState(() => {
    const items = buildModelItems();
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("inkwise-default-model") : null;
    if (saved && items.some((m) => m.id === saved)) return saved;
    return items.length > 0 ? items[0].id : "";
  });

  // Re-read model items when providers change (event dispatched by ModelsSection)
  useEffect(() => {
    const handler = () => {
      const items = buildModelItems();
      setModelItems(items);
    };
    return on("providers-changed", handler);
  }, []);

  const handleSelectModel = useCallback((id: string) => {
    setSelectedModel(id);
    try { localStorage.setItem("inkwise-default-model", id); } catch {}
    emit("providers-changed");
  }, []);
  const [selectedEffort, setSelectedEffort] = useState(() => {
    try { return localStorage.getItem("inkwise-effort") || EFFORTS[0].id; } catch { return EFFORTS[0].id; }
  });
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [effortMenuOpen, setEffortMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [currentIntent, setCurrentIntent] = useState("general");

  // Max tokens
  const [maxTokens, setMaxTokens] = useState(2048);
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const tokenBtnRef = useRef<HTMLButtonElement>(null);


  const [writingSkills, setWritingSkills] = useState<WritingSkill[]>([]);
  const [selectedWritingSkill, setSelectedWritingSkill] = useState(() => {
    try { return localStorage.getItem("inkwise-writing-skill") || "general"; } catch { return "general"; }
  });
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const writingSkillBtnRef = useRef<HTMLButtonElement>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const fallbackSkills: Skill[] = [
    { name: "general", description: "通用写作", body: "", scope: "Builtin", path: "", run_as: "Inline", allowed_tools: [], model: null, effort: null, enabled: true },
    { name: "academic", description: "学术写作", body: "", scope: "Builtin", path: "", run_as: "Subagent", allowed_tools: [], model: null, effort: "high", enabled: true },
    { name: "creative", description: "创意写作", body: "", scope: "Builtin", path: "", run_as: "Inline", allowed_tools: [], model: null, effort: null, enabled: true },
  ];
  const intentOptions: IntentOption[] = (skills.length > 0 ? skills : fallbackSkills).map((s) => ({
    id: s.name,
    label: skillDisplayLabel(s.name),
    desc: s.description,
    icon: <Sparkles size={13} />,
    active: currentIntent === s.name,
    onToggle: () => setCurrentIntent(s.name),
  }));

  // Load skills from backend
  useEffect(() => {
    listSkills().then(setSkills).catch(() => {});
  }, []);


  // Load writing skills
  useEffect(() => {
    (async () => {
      try {
        const customs = await loadCustomSkills();
        setWritingSkills(customs.length > 0 ? customs : getAllBuiltinSkills());
      } catch {
        setWritingSkills(getAllBuiltinSkills());
      }
    })();
  }, []);

  // Persist selected writing skill
  useEffect(() => {
    try { localStorage.setItem("inkwise-writing-skill", selectedWritingSkill); } catch {}
  }, [selectedWritingSkill]);
  const [fetchingModels, setFetchingModels] = useState(false);
  // ── Draw config state ──
  const [drawPanelOpen, setDrawPanelOpen] = useState(false);
  const [drawEnabled, setDrawEnabled] = useState(() => {
    try { return localStorage.getItem("inkwise-draw-enabled") === "true"; } catch { return false; }
  });
  const [drawModel, setDrawModel] = useState(() => {
    const models = getImageModelsSync();
    return models.length > 0 ? models[0].id : "dall-e-3";
  });
  const [drawStyle, setDrawStyle] = useState(() => {
    try { return localStorage.getItem("inkwise-draw-style") || "vivid"; } catch { return "vivid"; }
  });
  const [drawSize, setDrawSize] = useState(() => {
    try { return localStorage.getItem("inkwise-draw-size") || "1024x1024"; } catch { return "1024x1024"; }
  });
  const [drawCount, setDrawCount] = useState(() => {
    try { return parseInt(localStorage.getItem("inkwise-draw-count") || "1", 10); } catch { return 1; }
  });
  const [drawNegativePrompt, setDrawNegativePrompt] = useState(() => {
    try { return localStorage.getItem("inkwise-draw-negative-prompt") || ""; } catch { return ""; }
  });
  const [drawAdvancedOpen, setDrawAdvancedOpen] = useState(false);

  // Sync draw config to window.__drawConfig
  useEffect(() => {
    (window as any).__drawConfig = {
      enabled: drawEnabled,
      model: drawModel,
      style: drawStyle,
      size: drawSize,
      count: drawCount,
      negativePrompt: drawNegativePrompt,
    };
  }, [drawEnabled, drawModel, drawStyle, drawSize, drawCount, drawNegativePrompt]);

  // Persist draw config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("inkwise-draw-enabled", String(drawEnabled));
      localStorage.setItem("inkwise-draw-model", drawModel);
      localStorage.setItem("inkwise-draw-style", drawStyle);
      localStorage.setItem("inkwise-draw-size", drawSize);
      localStorage.setItem("inkwise-draw-count", String(drawCount));
      localStorage.setItem("inkwise-draw-negative-prompt", drawNegativePrompt);
    } catch {}
  }, [drawEnabled, drawModel, drawStyle, drawSize, drawCount, drawNegativePrompt]);

  // Image model items
  const [imageModelItems, setImageModelItems] = useState<ModelEntry[]>(() => getImageModelsSync());
  useEffect(() => {
    const handler = () => {
      setImageModelItems(getImageModelsSync());
    };
    return on("providers-changed", handler);
  }, []);



  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const effortBtnRef = useRef<HTMLButtonElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const startResizeRef = useRef({ startY: 0, startHeight: 0 });

  const sendDisabled = value.trim().length === 0 || sending || fetchingModels;

  const handleSend = useCallback(() => {
    if (sendDisabled) return;
    setLocalSending(true);
    onSend?.(value.trim());
    setValue("");
    setTimeout(() => setLocalSending(false), 600);
  }, [value, sendDisabled, onSend]);

  // Auto-resize textarea (only when not manually resized)
  useEffect(() => {
    if (composerHeight !== null) return;
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value, composerHeight]);

  // Resize
  const startResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const startHeight = cardRef.current?.getBoundingClientRect().height ?? COMPOSER_MIN_HEIGHT;
    startResizeRef.current = { startY: e.clientY, startHeight };
    setComposerHeight(startHeight);
    setResizing(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const { startY, startHeight } = startResizeRef.current;
    const onMove = (e: PointerEvent) => {
      const delta = startY - e.clientY;
      setComposerHeight(Math.max(COMPOSER_MIN_HEIGHT, Math.min(COMPOSER_MAX_HEIGHT, startHeight + delta)));
    };
    const onUp = () => setResizing(false);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    return () => { document.removeEventListener("pointermove", onMove); document.removeEventListener("pointerup", onUp); };
  }, [resizing]);

  // Revert to auto height on typing
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    if (composerHeight !== null) setComposerHeight(null);
  }, [composerHeight]);

  // Effort menu items with callbacks
  const effortItems: MenuItem[] = EFFORTS.map((e) => ({
    ...e,
    checked: selectedEffort === e.id,
    onClick: () => { setSelectedEffort(e.id); try { localStorage.setItem("inkwise-effort", e.id); emit("providers-changed"); } catch {} },
  }));

  // Token presets menu items
  const tokenItems: MenuItem[] = TOKEN_PRESETS.map((t) => ({
    id: String(t),
    label: String(t),
    checked: maxTokens === t,
    onClick: () => setMaxTokens(t),
  }));
  tokenItems.push({
    id: "unlimited",
    label: "无限制",
    checked: maxTokens === 0,
    onClick: () => setMaxTokens(0),
  });

  const moreItems: MenuItem[] = [
    { id: "new-doc", label: "新建文档", icon: <Play size={13} />, onClick: () => {} },
    { id: "save", label: "保存", icon: <Play size={13} />, onClick: () => {} },
    { id: "export-md", label: "导出 Markdown", icon: <Play size={13} />, onClick: () => {} },
    { id: "export-pdf", label: "导出 PDF", icon: <Play size={13} />, onClick: () => {} },
  ];


  const handleGenerateImage = useCallback(async () => {
    const sel = (window as any).__lastEditorSelection;
    if (!sel) return;
    const editor = (window as any).editorInstance?.editor;
    if (!editor) return;
    const text = editor.state.doc.textBetween(sel.from, sel.to, " ").trim();
    if (!text) return;
    const providers = getProvidersSync();
    let providerId = "";
    for (const p of providers) {
      if (!p.enabled) continue;
      if (p.models.some(m => m.id === drawModel)) { providerId = p.id; break; }
    }
    if (!providerId) { console.warn("未找到图片模型对应的 provider"); return; }
    const articleId = (window as any).__currentArticleId || "";
    try {
      const result = await invokeOrFallback<string[]>("generate_image", {
        providerId,
        model: drawModel,
        prompt: text,
        negativePrompt: drawNegativePrompt || null,
        size: drawSize || null,
        quality: null,
        style: drawStyle || null,
        n: drawCount,
        articleId,
        projectFolder: null,
      }, () => []);
      if (result.length > 0) {
        editor.chain().focus().insertContent("\n" + result.join("\n\n") + "\n").run();
      }
    } catch (err) {
      console.error("generate_image failed:", err);
    }
  }, [drawModel, drawStyle, drawSize, drawCount, drawNegativePrompt]);

  const selectedLabel = modelItems.find((m) => m.id === selectedModel)?.label ?? selectedModel ?? "加载中…";
  const tokenLabel = maxTokens ? String(maxTokens) : "∞";

  const cardClass = [
    "composer-card",
    composerHeight !== null ? "composer-card--resized" : "",
    resizing ? "composer-card--resizing" : "",
    sending ? "composer-card--sending" : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="composer-wrap">
      <div
        ref={cardRef}
        className={cardClass}
        style={composerHeight !== null ? { height: composerHeight } as React.CSSProperties : undefined}
      >
        {/* Resize handle */}
        <button className="composer-resize-handle" type="button" aria-label="调整输入区高度" onPointerDown={startResize} />

        {/* Input row */}
        <div className="composer">
          <span className="composer__caret" aria-hidden="true">{">"}</span>
          <textarea
            ref={inputRef}
            className="composer__input"
            placeholder="输入 AI 指令… (Ctrl+Enter 发送)"
            value={value}
            rows={1}
            onChange={handleInputChange}
            onKeyDown={(e) => { if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); handleSend(); } }}
          />
          <button className="composer__btn composer__btn--send" disabled={sendDisabled} onClick={handleSend} aria-label="发送">
            {sending ? <span className="composer__spinner" /> : <SendHorizonal size="18" />}
          </button>
        </div>

        {/* Meta toolbar row */}
        <div className="composer-meta">
          <div className="composer-meta__params">
            {/* Intent chip */}
            <div className="composer-meta__control composer-meta__control--intent">
              <IntentMenu currentIntent={currentIntent} options={intentOptions} />
            </div>

            {/* Writing skill selector */}
            <div className="composer-meta__control composer-meta__control--writing-skill">
              <button
                ref={writingSkillBtnRef}
                className="pill-btn"
                onClick={() => setSkillMenuOpen(!skillMenuOpen)}
                title="写作风格"
              >
                <span>{getWritingSkillIcon(selectedWritingSkill, writingSkills)}</span>
                <span>{getWritingSkillLabel(selectedWritingSkill, writingSkills)}</span>
              </button>
              <PopoverMenu
                items={writingSkills.map(s => ({
                  id: s.id,
                  label: `${s.icon} ${s.name}`,
                  subtitle: s.description,
                  onClick: () => {
                    setSelectedWritingSkill(s.id);
                    emit("writing-skill-changed", s.id);
                  },
                }))}
                anchorRef={writingSkillBtnRef}
                open={skillMenuOpen}
                onClose={() => setSkillMenuOpen(false)}
              />
            </div>

            {/* Max tokens */}
            <div className="composer-meta__control composer-meta__control--tokens">
              <button
                ref={tokenBtnRef}
                className="pill-btn"
                onClick={() => setTokenMenuOpen(!tokenMenuOpen)}
                title="最大输出 token 数"
              >
                <Type size={11} />
                <span>{tokenLabel}</span>
              </button>
              <PopoverMenu
                items={tokenItems}
                anchorRef={tokenBtnRef}
                open={tokenMenuOpen}
                onClose={() => setTokenMenuOpen(false)}
              />
            </div>

            {/* Model selector */}
            <div className="composer-meta__control composer-meta__control--model">
              <button
                ref={modelBtnRef}
                className="modelsw__trigger"
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
              >
                <Brain size={13} />
                <span className="modelsw__label">{selectedLabel}</span>
                <span className="modelsw__chevron"><ChevronsUpDown size={11} /></span>
              </button>
              {modelItems.length > 0 && (
                <PopoverMenu
                  items={modelItems.map((m) => ({
                    ...m,
                    checked: selectedModel === m.id,
                    onClick: () => handleSelectModel(m.id),
                  }))}
                  anchorRef={modelBtnRef}
                  open={modelMenuOpen}
                  onClose={() => setModelMenuOpen(false)}
                />
              )}
            </div>

            {/* Effort selector */}
            <div className="composer-meta__control composer-meta__control--effort">
              <button
                ref={effortBtnRef}
                className="pill-btn"
                onClick={() => setEffortMenuOpen(!effortMenuOpen)}
              >
                <Gauge size={12} />
                <span>{EFFORTS.find((e) => e.id === selectedEffort)?.label ?? selectedEffort}</span>
              </button>
              <PopoverMenu
                items={effortItems}
                anchorRef={effortBtnRef}
                open={effortMenuOpen}
                onClose={() => setEffortMenuOpen(false)}
              />
            </div>
          </div>

          {/* Draw / More actions */}
          <div className="composer-meta__actions">
            <button
              className="pill-btn"
              title="插图设置"
              onClick={() => setDrawPanelOpen(!drawPanelOpen)}
            >
              <Image size={11} />
              <span>插图</span>
            </button>
            <button
              className="composer-action-trigger"
              title="生成插图"
              onClick={handleGenerateImage}
            >
              <Image size={14} />
            </button>
            <button
              ref={moreBtnRef}
              className="composer-action-trigger"
              title="更多选项"
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
            >
              <MoreHorizontal size={15} />
            </button>
            <PopoverMenu
              items={moreItems}
              anchorRef={moreBtnRef}
              open={moreMenuOpen}
              onClose={() => setMoreMenuOpen(false)}
              width={190}
              align="end"
            />
          </div>
        </div>

        {/* Draw settings panel */}
        {drawPanelOpen && (
          <div className="composer-draw-panel">
            <label className="composer-draw__row">
              <input
                type="checkbox"
                checked={drawEnabled}
                onChange={(e) => setDrawEnabled(e.target.checked)}
              />
              <span>自动配图</span>
            </label>

            <div className="composer-draw__row">
              <span className="composer-draw__label">绘图模型</span>
              <select
                className="composer-draw__select"
                value={drawModel}
                onChange={(e) => setDrawModel(e.target.value)}
              >
                {imageModelItems.map((m) => (
                  <option key={m.id} value={m.id}>{m.id}</option>
                ))}
              </select>
            </div>

            <div className="composer-draw__row">
              <span className="composer-draw__label">风格</span>
              <select
                className="composer-draw__select"
                value={drawStyle}
                onChange={(e) => setDrawStyle(e.target.value)}
              >
                <option value="vivid">生动 (Vivid)</option>
                <option value="natural">自然 (Natural)</option>
              </select>
            </div>

            <div className="composer-draw__row">
              <span className="composer-draw__label">尺寸</span>
              <select
                className="composer-draw__select"
                value={drawSize}
                onChange={(e) => setDrawSize(e.target.value)}
              >
                {imageModelItems
                  .find((m) => m.id === drawModel)
                  ?.imageConfig?.sizes.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  )) ?? (
                  <>
                    <option value="1024x1024">1024x1024</option>
                    <option value="1792x1024">1792x1024</option>
                    <option value="1024x1792">1024x1792</option>
                  </>
                )}
              </select>
            </div>

            <div className="composer-draw__row">
              <span className="composer-draw__label">数量</span>
              <select
                className="composer-draw__select"
                value={drawCount}
                onChange={(e) => setDrawCount(Number(e.target.value))}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="composer-draw__advanced">
              <button
                className="composer-draw__advanced-toggle"
                onClick={() => setDrawAdvancedOpen(!drawAdvancedOpen)}
              >
                {drawAdvancedOpen ? "收起" : "展开"}高级设置
              </button>
              {drawAdvancedOpen && (
                <textarea
                  className="composer-draw__neg-input"
                  placeholder="负面提示词（不希望出现的内容）…"
                  value={drawNegativePrompt}
                  onChange={(e) => setDrawNegativePrompt(e.target.value)}
                  rows={2}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function getWritingSkillLabel(skillId: string, skills: WritingSkill[]): string {
  const skill = skills.find(s => s.id === skillId);
  return skill?.name ?? skillId;
}

function getWritingSkillIcon(skillId: string, skills: WritingSkill[]): string {
  const skill = skills.find(s => s.id === skillId);
  return skill?.icon ?? "\u{1F4DD}";
}

function skillDisplayLabel(name: string): string {
  const labels: Record<string, string> = {
    "continue-writing": "续写",
    "rewrite": "改写",
    "polish": "润色",
    "translate": "翻译",
    "academic": "学术",
    "creative": "创意",
    "summary": "摘要",
    "outline": "大纲",
    "expand": "扩写",
    "paraphrase": "同义改写",
    "proofread": "校对",
    "blog": "博客",
    "novel": "小说",
    "headline": "标题",
    "email": "邮件",
    "keyword-extract": "关键词",
    "readability": "可读性",
    "citation": "引用",
    "general": "通用",
    "professional": "商务",
  };
  return labels[name] || name;
}

function buildModelItems(): MenuItem[] {
  const providers = getProvidersSync();
  const modelProviderMap = new Map<string, string>();
  const allModels: string[] = [];
  for (const p of providers) {
    if (p.models.length > 0) {
      for (const m of p.models) {
        modelProviderMap.set(m.id, p.label);
        allModels.push(m.id);
      }
    }
  }
  return allModels.map((id) => ({
    id,
    label: id,
    subtitle: modelProviderMap.get(id) ?? "",
    checked: false,
    onClick: () => {},
  }));
}
