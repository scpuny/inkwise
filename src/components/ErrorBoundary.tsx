import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  name?: string; // Which section, for error display
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    console.error(`[ErrorBoundary:${this.props.name ?? "root"}]`, error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    this.props.onReset?.();
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="error-boundary" data-section={this.props.name}>
          <div className="error-boundary__card">
            <div className="error-boundary__icon">
              <AlertTriangle size={24} />
            </div>
            <h2 className="error-boundary__title">
              {this.props.name ?? "应用"}遇到问题
            </h2>
            <p className="error-boundary__message">
              {this.state.error?.message || "发生了未知错误"}
            </p>
            <div className="error-boundary__actions">
              <button className="btn btn--primary" onClick={this.handleReload}>
                <RefreshCw size={14} />
                重新加载
              </button>
              <button className="btn" onClick={this.handleReset}>
                <Home size={14} />
                重试
              </button>
            </div>
            {this.state.error?.stack && (
              <details className="error-boundary__details">
                <summary>错误详情</summary>
                <pre className="error-boundary__stack">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
