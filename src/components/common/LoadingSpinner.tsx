// LoadingSpinner.tsx — 通用加载旋转器
// 用于编辑器面板、规划面板等场景的加载状态

interface LoadingSpinnerProps {
  message?: string;
  size?: number;
}

export function LoadingSpinner({ message = "加载中…", size = 18 }: LoadingSpinnerProps) {
  return (
    <div className="editor-pane__loading">
      <svg
        className="editor-pane__loading-spin"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M21 12a9 9 0 11-6.219-8.56" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
