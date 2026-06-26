import {
  Brain,
  ChevronsUpDown,
  Gauge,
  MoreHorizontal,
  Play,
  SendHorizonal,
  Sparkles,
  Type,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { emit, on } from "../../lib/events/eventBus";
import { getProvidersSync } from "../../lib/storage/providerModels";
import { listSkills, type Skill } from "../../lib/storage/skill";
import { PopoverMenu, type MenuItem } from "../common/PopoverMenu";
import { IntentMenu, type IntentOption } from "./IntentMenu";

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
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("aiwriter-default-model") : null;
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
    try { localStorage.setItem("aiwriter-default-model", id); } catch {}
    emit("providers-changed");
  }, []);
  const [selectedEffort, setSelectedEffort] = useState(() => {
    try { return localStorage.getItem("aiwriter-effort") || EFFORTS[0].id; } catch { return EFFORTS[0].id; }
  });
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [effortMenuOpen, setEffortMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [currentIntent, setCurrentIntent] = useState("general");

  // Max tokens
  const [maxTokens, setMaxTokens] = useState(2048);
  const [tokenMenuOpen, setTokenMenuOpen] = useState(false);
  const tokenBtnRef = useRef<HTMLButtonElement>(null);

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

  const [fetchingModels, setFetchingModels] = useState(false);

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
    onClick: () => { setSelectedEffort(e.id); try { localStorage.setItem("aiwriter-effort", e.id); emit("providers-changed"); } catch {} },
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

          {/* More actions */}
          <div className="composer-meta__actions">
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
      </div>
    </div>
  );
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
        modelProviderMap.set(m, p.label);
        allModels.push(m);
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
