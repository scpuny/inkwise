import { useEffect, useState, useCallback } from "react";
import {
  Brain, Gauge, CircleDollarSign, FileText, Clock, Type,
} from "lucide-react";
import { getProvidersSync } from "../lib/providerModels";

export function StatusBar() {
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [paragraphCount, setParagraphCount] = useState(0);
  const [readTime, setReadTime] = useState("0分钟");
  const [modelName, setModelName] = useState("—");
  const [effort, setEffort] = useState("自动");
  const [hasDocs, setHasDocs] = useState(false);

  const updateStats = useCallback(() => {
    const editor = (window as any).editorInstance?.editor;
    if (!editor) {
      setWordCount(0); setCharCount(0); setParagraphCount(0);
      setReadTime("0分钟"); setHasDocs(false);
      return;
    }
    setHasDocs(true);
    const text = editor.getText();
    setCharCount(text.length);
    const cnChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const westernWords = text.replace(/[\u4e00-\u9fff]/g, " ").trim().split(/\s+/).filter(Boolean).length;
    const words = cnChars + westernWords;
    setWordCount(words);
    const html = editor.getHTML();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const paragraphs = doc.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, blockquote");
    setParagraphCount(paragraphs.length);
    const readMinutes = Math.ceil(words / 300);
    setReadTime(readMinutes <= 0 ? "<1分钟" : `${readMinutes}分钟`);
  }, []);

  // Sync model/effort from AIBar
  useEffect(() => {
    const interval = setInterval(() => {
      const providers = getProvidersSync();
      const enabled = providers.find((p) => p.enabled && p.models.length > 0);
      if (enabled && enabled.models.length > 0) {
        setModelName(enabled.models[0]);
      }
      setEffort("自动");
    }, 2000);
    updateStats();
    return () => clearInterval(interval);
  }, [updateStats]);

  // Listen for editor content changes
  useEffect(() => {
    updateStats();
    const handler = () => updateStats();
    const editorEl = document.getElementById("editorMain");
    if (editorEl) {
      const observer = new MutationObserver(handler);
      observer.observe(editorEl, { childList: true, subtree: true, characterData: true });
      return () => observer.disconnect();
    }
  }, [updateStats]);

  return (
    <div className="statusbar">
      {/* Document stats — only show when article is open */}
      {hasDocs && (
        <span className="statusbar__group">
          <span className="statusbar__item stat">
            <Type size={11} />
            <span className="stat__label">字数</span>
            <b>{wordCount.toLocaleString()}</b>
          </span>
          <span className="statusbar__item stat">
            <span className="stat__label">字符</span>
            <b>{charCount.toLocaleString()}</b>
          </span>
          <span className="statusbar__item stat">
            <FileText size={11} />
            <span className="stat__label">段落</span>
            <b>{paragraphCount}</b>
          </span>
          <span className="statusbar__item stat">
            <Clock size={11} />
            <span className="stat__label">阅读</span>
            <b>{readTime}</b>
          </span>
        </span>
      )}

      {/* Model info */}
      <span className="statusbar__group">
        <span className="statusbar__item stat">
          <Brain size={12} />
          <span className="stat__label">模型</span>
          <b className="statusbar__model">{modelName}</b>
        </span>
        <span className="statusbar__item stat">
          <Gauge size={12} />
          <b>{effort}</b>
        </span>
      </span>

      {/* Status dot */}
      <span className="statusbar__group">
        <span className="statusbar__item statusbar__dot" />
        <span className="statusbar__item stat">
          <span className="stat__label">{hasDocs ? "就绪" : "空闲"}</span>
        </span>
      </span>
    </div>
  );
}
