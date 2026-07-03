// UpdateDialog.tsx — 启动时自动检查更新弹窗

import { useState, useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";

const APP_VERSION = "1.10.0";
const GITHUB_REPO = "scpuny/inkwise";
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;
const DISMISS_KEY = "inkwise-update-dismiss";

export function UpdateDialog() {
  const [state, setState] = useState<"loading" | "ready" | "latest" | "error" | "done">("loading");
  const [latestVersion, setLatestVersion] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [open, setOpen] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 避免 dev 热重载重复请求：只检查一次
    if ((window as any).__updateCheckDone) return;
    (window as any).__updateCheckDone = true;
    // 延迟 3 秒，不干扰启动后的初始化操作
    const timer = setTimeout(checkUpdate, 3000);
    return () => clearTimeout(timer);
  }, []);

  const checkUpdate = async () => {
    // 避免在 dismissed error 状态下重复
    try {
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { Accept: "application/vnd.github.v3+json" } }
      );
      if (!res.ok) {
        if (res.status === 403) throw new Error("API 频率限制");
        throw new Error(`GitHub API 响应异常 (${res.status})`);
      }
      const data = await res.json();
      const latest = (data.tag_name || data.name || "").replace(/^v/, "");

      const dismissed = getDismissedVersion();
      if (!latest || latest === APP_VERSION || dismissed === latest) {
        setState("done");
        return;
      }

      setLatestVersion(latest);
      setState("ready");
    } catch (e: any) {
      setErrorMsg(e?.message || String(e));
      setState("error");
      // 出错时不弹窗，静默失败
      setTimeout(() => setState("done"), 100);
    }
  };

  const handleDismiss = () => {
    if (latestVersion) {
      localStorage.setItem(DISMISS_KEY, latestVersion);
    }
    setOpen(false);
  };

  const handleLater = () => {
    setOpen(false);
  };

  if (!open || state === "done" || state === "loading" || state === "latest") return null;

  return (
    <div className="dialog-backdrop" onClick={handleLater} style={{ zIndex: 9999 }}>
      <div className="dialog" ref={dialogRef} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="dialog__head">
          <span style={{ fontWeight: 600, fontSize: 14 }}>发现新版本</span>
          <button className="dialog__close" onClick={handleLater} aria-label="稍后提醒">
            <X size={14} />
          </button>
        </div>

        {state === "error" ? (
          <div style={{ padding: "20px 24px", fontSize: 13, color: "var(--err)" }}>
            检查更新失败：{errorMsg}
            <div style={{ marginTop: 12 }}>
              <a className="btn btn--small" href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
                手动查看 <ExternalLink size={12} />
              </a>
            </div>
          </div>
        ) : (
          <div style={{ padding: "20px 24px" }}>
            <p style={{ fontSize: 13, color: "var(--fg-dim)", lineHeight: 1.6, margin: 0 }}>
              发现 InkWise <strong>v{latestVersion}</strong> 新版本（当前 v{APP_VERSION}），
              建议升级以获得最新功能和改进。
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 16 }}>
              <a
                className="btn btn--primary btn--small"
                href={RELEASES_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleDismiss}
              >
                前往下载 <ExternalLink size={12} />
              </a>
              <button className="btn btn--small" onClick={handleDismiss}>
                不再提示
              </button>
              <button className="btn btn--small" onClick={handleLater}>
                稍后提醒
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function getDismissedVersion(): string | null {
  try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
}
