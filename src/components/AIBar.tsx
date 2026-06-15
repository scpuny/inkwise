import { useState, useCallback, useRef, useEffect } from "react";
import {
  SendHorizonal, Play, Sparkles, Edit3, Languages,
  MoreHorizontal, Brain, Gauge, ChevronsUpDown,
} from "lucide-react";
import { PopoverMenu, type MenuItem } from "./PopoverMenu";
import { IntentMenu, type IntentOption } from "./IntentMenu";
import { fetchAvailableModels, getProvidersSync, getAllModels, type Provider } from "../lib/providerModels";

const COMPOSER_MIN_HEIGHT = 104;
const COMPOSER_MAX_HEIGHT = 360;

const EFFORTS: MenuItem[] = [
  { id: "auto", label: "自动", subtitle: "由系统决定", onClick: () => {} },
  { id: "low", label: "低", subtitle: "快速响应", onClick: () => {} },
  { id: "medium", label: "中", subtitle: "平衡", onClick: () => {} },
  { id: "high", label: "高", subtitle: "深度思考", onClick: () => {} },
];

export function AIBar({ onSend, sending: externalSending, onIntent }: { onSend?: (text: string) => void; sending?: boolean; onIntent?: (intent: string) => void }) {
  const [value, setValue] = useState("");
  const [localSending, setLocalSending] = useState(false);
  const sending = externalSending ?? localSending;
  const [resizing, setResizing] = useState(false);
  const [composerHeight, setComposerHeight] = useState<number | null>(null);

  // Model list from provider API
  const [modelItems, setModelItems] = useState<MenuItem[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedEffort, setSelectedEffort] = useState(EFFORTS[0].id);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [effortMenuOpen, setEffortMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [currentIntent, setCurrentIntent] = useState("general");
  const intentOptions: IntentOption[] = [
    { id: "general", label: "通用", desc: "通用写作助手，适合各类写作场景", icon: <Sparkles size={13} />, active: currentIntent === "general", onToggle: () => setCurrentIntent("general") },
    { id: "academic", label: "学术", desc: "严谨学术风格，适合论文和报告", icon: <Brain size={13} />, active: currentIntent === "academic", onToggle: () => setCurrentIntent("academic") },
    { id: "creative", label: "创意", desc: "富有创意和文学性的表达", icon: <Sparkles size={13} />, active: currentIntent === "creative", onToggle: () => setCurrentIntent("creative") },
    { id: "professional", label: "商务", desc: "专业的商务沟通风格", icon: <Gauge size={13} />, active: currentIntent === "professional", onToggle: () => setCurrentIntent("professional") },
  ];
  const [fetchingModels, setFetchingModels] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);
  const effortBtnRef = useRef<HTMLButtonElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const startResizeRef = useRef({ startY: 0, startHeight: 0 });

  // Fetch all configured models from all enabled providers on mount
  useEffect(() => {
    let cancelled = false;
    const loadModels = async () => {
      setFetchingModels(true);
      try {
        const allModels = await getAllModels();
        if (!cancelled) {
          const providers = getProvidersSync();
          // Build a map: modelId -> provider label
          const modelProviderMap = new Map<string, string>();
          for (const p of providers) {
            if (p.enabled && p.models.length > 0) {
              for (const m of p.models) {
                modelProviderMap.set(m, p.label);
              }
            }
          }
          const items: MenuItem[] = allModels.map((id) => ({
            id,
            label: id,
            subtitle: modelProviderMap.get(id) ?? "",
            checked: false,
            onClick: () => setSelectedModel(id),
          }));
          setModelItems(items);
          // Select first model
          if (items.length > 0) {
            setSelectedModel(items[0].id);
          }
        }
      } catch {
        // Keep items empty if fetch fails
      } finally {
        if (!cancelled) setFetchingModels(false);
      }
    };
    loadModels();
    return () => { cancelled = true; };
  }, []);

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

  // Quick action intent handlers — sends directly with selected text context
  const handleIntent = useCallback((key: string) => {
    const editor = (window as any).editorInstance?.editor;
    const selectedText = editor ? editor.state.selection.content().slice(0, -1).toString().trim() : "";
    
    let prompt = "";
    if (key === "continue") {
      prompt = "请继续扩写当前文档内容，保持文风一致。直接输出续写内容。";
    } else if (key === "rewrite") {
      prompt = selectedText 
        ? `请改写以下文本，提升表达质量，保持原意：\n\n${selectedText}`
        : "请改写当前选中的文本。如未选中文本，请告诉我需要改写的内容。";
    } else if (key === "polish") {
      prompt = selectedText
        ? `请润色以下文本，使语言更加流畅自然：\n\n${selectedText}`
        : "请润色当前选中的文本。";
    } else if (key === "translate") {
      prompt = selectedText
        ? `请将以下文本翻译为英文：\n\n${selectedText}`
        : "请翻译当前选中的文本为英文。";
    }
    
    setValue(prompt);
    inputRef.current?.focus();
    // Auto-send if we have selected text context
    if (selectedText) {
      setTimeout(() => {
        setValue(prompt);
        onSend?.(prompt);
        setValue("");
      }, 100);
    } else {
      onIntent?.(prompt);
    }
  }, [onIntent, onSend]);

  // Effort menu items with callbacks
  const effortItems: MenuItem[] = EFFORTS.map((e) => ({
    ...e,
    checked: selectedEffort === e.id,
    onClick: () => setSelectedEffort(e.id),
  }));

  const moreItems: MenuItem[] = [
    { id: "new-doc", label: "新建文档", icon: <Play size={13} />, onClick: () => {} },
    { id: "save", label: "保存", icon: <Play size={13} />, onClick: () => {} },
    { id: "export-md", label: "导出 Markdown", icon: <Play size={13} />, onClick: () => {} },
    { id: "export-pdf", label: "导出 PDF", icon: <Play size={13} />, onClick: () => {} },
  ];

  const selectedLabel = modelItems.find((m) => m.id === selectedModel)?.label ?? selectedModel ?? "加载中…";

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

            {/* Quick actions */}
            <div className="composer-meta__control composer-meta__control--quick">
              <button className="pill-btn pill-btn--icon" type="button" title="继续写作" onClick={() => handleIntent("continue")}><Play size={11} /><span>继续</span></button>
              <button className="pill-btn pill-btn--icon" type="button" title="改写" onClick={() => handleIntent("rewrite")}><Edit3 size={11} /><span>改写</span></button>
              <button className="pill-btn pill-btn--icon" type="button" title="润色" onClick={() => handleIntent("polish")}><Sparkles size={11} /><span>润色</span></button>
              <button className="pill-btn pill-btn--icon" type="button" title="翻译" onClick={() => handleIntent("translate")}><Languages size={11} /><span>翻译</span></button>
            </div>

            {/* Model selector */}
            <div className="composer-meta__control composer-meta__control--model">
              <button
                ref={modelBtnRef}
                className="modelsw__trigger"
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
              >
                <Brain size={13} />
                <span className="modelsw__label">{fetchingModels ? "加载中…" : selectedLabel}</span>
                <span className="modelsw__chevron"><ChevronsUpDown size={11} /></span>
              </button>
              {modelItems.length > 0 && (
                <PopoverMenu
                  items={modelItems.map((m) => ({
                    ...m,
                    checked: selectedModel === m.id,
                    onClick: () => setSelectedModel(m.id),
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
