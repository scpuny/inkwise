import { Sparkles, Edit3, BookOpen, SquarePen } from "lucide-react";

export function StartupSplash({ onNewDoc }: { onNewDoc?: () => void }) {
  const examples = [
    "写一篇关于秋天午后的短文",
    "帮我润色这段文字，让它更生动",
    "将下面的内容翻译成英文",
    "为这篇文章写一个开篇段落",
  ];

  return (
    <main className="editor-main">
      <div className="startup-splash">
        <div className="startup-splash__brand">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <h1>AI 写作助手</h1>
        </div>

        <p className="startup-splash__tagline">开始写作，或输入指令让 AI 帮你创作</p>

        <div className="startup-splash__actions">
          <button className="startup-splash__btn" onClick={onNewDoc}>
            <SquarePen size="16" />
            <span>新建空白文档</span>
          </button>
          <button className="startup-splash__btn startup-splash__btn--secondary">
            <BookOpen size="16" />
            <span>使用模板</span>
          </button>
        </div>

        <div className="startup-splash__examples">
          <h3>快速开始</h3>
          {examples.map((ex, i) => (
            <button key={i} className="startup-splash__ex">
              <Sparkles size={13} />
              <span>{ex}</span>
            </button>
          ))}
        </div>

        <div className="startup-splash__shortcuts">
          <span><kbd>Ctrl+K</kbd> 聚焦 AI 输入</span>
          <span><kbd>Ctrl+N</kbd> 新建文档</span>
          <span><kbd>Ctrl+\</kbd> 切换侧栏</span>
        </div>
      </div>
    </main>
  );
}
