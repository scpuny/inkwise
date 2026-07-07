// AboutSection.tsx — 关于：版本信息与在线升级检查

import { useState, useEffect } from "react";
import { SettingsPage } from "./SettingsPageLayout";
import { Loader2 } from "lucide-react";

const APP_VERSION = "1.10.0";
const GITHUB_REPO = "scpuny/inkwise";
const RELEASES_URL = `https://github.com/${GITHUB_REPO}/releases`;

type CheckState = "idle" | "checking" | "ok" | "error";

const GitHubIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.085 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0z"/>
  </svg>
);

export function AboutSection() {
  const [checkState, setCheckState] = useState<CheckState>("idle");
  const [latestVersion, setLatestVersion] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleCheckUpdate = async () => {
    setCheckState("checking");
    setErrorMsg("");
    try {
      // Use public GitHub API (no auth needed for public repos, rate-limited)
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        { headers: { Accept: "application/vnd.github.v3+json" } }
      );
      if (!res.ok) {
        if (res.status === 403) throw new Error("API 频率限制，稍后再试");
        throw new Error(`GitHub API 响应异常 (${res.status})`);
      }
      const data = await res.json();
      const latest = data.tag_name?.replace(/^v/, "") || data.name || "";
      setLatestVersion(latest);

      // Compare versions (simple string compare since semver)
      const current = APP_VERSION;
      const isNewer = compareVersions(latest, current) > 0;
      setCheckState(isNewer ? "ok" : "ok");
      if (!isNewer) {
        setLatestVersion(`已是最新版本`);
      }
    } catch (e: any) {
      setCheckState("error");
      setErrorMsg(e?.message || String(e));
      // Fallback: open releases page directly
    }
  };

  return (
    <SettingsPage title="关于">
      <div className="about-card">
        <div className="about-card__logo">
          <img src="/inkwise-icon.svg" width="100" height="100" alt="InkWise" />
        </div>
        <h3>InkWise · 墨智</h3>
        <p className="about-card__version">v{APP_VERSION}</p>
        <p className="about-card__desc">
          AI 辅助写作工具。支持多种 AI 提供商、智能写作技能、多平台发布。
        </p>

        {/* 升级检查 */}
        <div className="about-update">
          {checkState === "idle" && (
            <button className="btn btn--small" onClick={handleCheckUpdate}>
              检查更新
            </button>
          )}
          {checkState === "checking" && (
            <span className="about-update__checking">
              <Loader2 size={13} className="about-update__spinner" /> 检查中…
            </span>
          )}
          {checkState === "ok" && latestVersion && (
            <div className="about-update__result">
              {latestVersion === "已是最新版本" ? (
                <span className="about-update__latest">已是最新版本 ✓</span>
              ) : (
                <span className="about-update__available">
                  发现新版本 <strong>v{latestVersion}</strong>
                  <a className="btn btn--small" href={RELEASES_URL} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 10 }}>
                    前往下载 <GitHubIcon size={12} />
                  </a>
                </span>
              )}
            </div>
          )}
          {checkState === "error" && (
            <div className="about-update__error">
              <span>{errorMsg || "检查失败"}</span>
              <a className="btn btn--small" href={RELEASES_URL} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 10 }}>
                前往发布页 <GitHubIcon size={12} />
              </a>
            </div>
          )}
        </div>

        <div className="about-card__tech">
          <span>React 19</span>
          <span>TypeScript</span>
          <span>Vite 6</span>
          <span>Tauri 2</span>
          <span>Rust</span>
        </div>

        <div className="about-card__links">
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer">
            GitHub <GitHubIcon size={11} />
          </a>
        </div>
      </div>
    </SettingsPage>
  );
}

/** 简单的 semver 比较：返回正数则 a > b */
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}
