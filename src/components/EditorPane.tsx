import { useState, useCallback, useEffect, useRef } from "react";
import { Toolbar } from "./Toolbar";
import { EditorContent, type EditorMode } from "./EditorContent";
import { AIBar } from "./AIBar";
import { StartupSplash } from "./StartupSplash";
import { sendChat, type ChatMessage } from "../lib/ai";
import { getProvidersSync } from "../lib/providerModels";
import { saveArticleContent, loadArticleContent } from "../lib/articles";
import { parseOutlineFromMarkdown, type OutlineItem } from "./OutlinePanel";

export function EditorPane({
  aiDockOpen,
  onToggleAIDock,
  hasActiveArticle,
  activeArticleId,
  onNewDoc,
  editorMode: parentEditorMode,
  editorLineHeight: parentLineHeight,
  onSetEditorFormat,
  onSetEditorLineHeight,
  onOutlineChange,
}: {
  aiDockOpen: boolean;
  onToggleAIDock: () => void;
  hasActiveArticle: boolean;
  activeArticleId?: string | null;
  onNewDoc?: () => void;
  editorMode: EditorMode;
  editorLineHeight: number;
  onSetEditorFormat?: (mode: EditorMode) => void;
  onSetEditorLineHeight?: (h: number) => void;
  onOutlineChange?: (items: OutlineItem[]) => void;
}) {
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [editorContent, setEditorContent] = useState<string>("");
  const contentRef = useRef<string>("");
  const autoSaveTimer = useRef<any>(undefined);
  const outlineTimer = useRef<any>(undefined);

  // Debounced outline sync
  const updateOutline = useCallback((content: string) => {
    if (onOutlineChange) {
      const items = parseOutlineFromMarkdown(content);
      if (outlineTimer.current) clearTimeout(outlineTimer.current);
      outlineTimer.current = setTimeout(() => onOutlineChange(items), 300);
    }
  }, [onOutlineChange]);

  // Load article content when article changes
  useEffect(() => {
    if (!activeArticleId) {
      setEditorContent("");
      onOutlineChange?.([]);
      return;
    }
    loadArticleContent(activeArticleId).then((content) => {
      if (content) {
        setEditorContent(content);
        contentRef.current = content;
        updateOutline(content);
      } else {
        const defaultContent = "# 无标题\n\n开始写作…\n";
        setEditorContent(defaultContent);
        contentRef.current = defaultContent;
        updateOutline(defaultContent);
      }
    });
  }, [activeArticleId, updateOutline]);

  // Auto-save on content change
  const handleContentChange = useCallback((content: string, mode?: EditorMode) => {
    contentRef.current = content;
    setEditorContent(content);
    updateOutline(content);
    if (mode) { /* editor mode is controlled by parent */ }
    if (!activeArticleId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveArticleContent(activeArticleId, content);
    }, 1500); // debounce 1.5s
  }, [activeArticleId]);

  const handleSend = useCallback(async (userMessage: string) => {
    if (!userMessage.trim()) return;
    setSending(true);
    setAiResponse(null);

    const providers = getProvidersSync();
    const enabled = providers.find((p) => p.enabled && p.models.length > 0);
    if (!enabled) {
      setAiResponse("请先在设置 → 模型中配置 AI 提供商和 API Key。");
      setSending(false);
      return;
    }

    // Include editor context if this is a rewrite/polish/translate prompt
    const editor = (window as any).editorInstance?.editor;
    const fullText = editor?.getText() || "";
    const isContextAction = userMessage.includes("扩写") || userMessage.includes("改写") || userMessage.includes("润色") || userMessage.includes("翻译");
    
    let systemPrompt = "你是一个专业的 AI 写作助手。请根据用户的指令帮助写作、润色、改写或翻译文本。直接输出结果，无需额外解释。";
    let userPrompt = userMessage;
    
    if (isContextAction && fullText) {
      const selectedText = editor?.state.selection.content().slice(0, -1).toString().trim() || "";
      if (selectedText) {
        // Selected text is already in the prompt via AIBar
      } else {
        // Include current document context for continue action
        const lastParagraph = fullText.split("\n").filter(Boolean).slice(-3).join("\n");
        userPrompt = `${userMessage}\n\n当前文档末尾内容：\n${lastParagraph}`;
      }
    }

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    try {
      const response = await sendChat({
        providerId: enabled.id,
        model: enabled.models[0],
        messages,
        temperature: 0.7,
        maxTokens: 2048,
      });
      setAiResponse(response);
    } catch (e: any) {
      setAiResponse(`调用失败: ${e?.message || e}`);
    } finally {
      setSending(false);
    }
  }, []);

  const handleInsertResponse = useCallback((response: string) => {
    setAiResponse(null);
  }, []);

  return (
    <section className="editor-pane">
      <Toolbar
        aiDockOpen={aiDockOpen}
        onToggleAIDock={onToggleAIDock}
        onModeSwitch={onSetEditorFormat}
        editorMode={parentEditorMode}
      />
      {hasActiveArticle ? (
        <EditorContent
          content={editorContent}
          mode={parentEditorMode}
          lineHeight={parentLineHeight}
          paragraphGap="1.25em"
          aiResponse={aiResponse}
          sending={sending}
          onChange={handleContentChange}
          onClearResponse={() => setAiResponse(null)}
          onInsertResponse={handleInsertResponse}
          onOutlineChange={onOutlineChange}
        />
      ) : (
        <StartupSplash onNewDoc={onNewDoc} />
      )}
      <footer className="footer">
        <AIBar onSend={handleSend} sending={sending} onIntent={() => { /* input pre-filled by AIBar */ }} />
      </footer>
    </section>
  );
}
