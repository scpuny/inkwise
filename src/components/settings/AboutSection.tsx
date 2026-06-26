// AboutSection.tsx — 关于页面：应用信息与技术栈
import { SettingsPage } from "./SettingsPageLayout";

export function AboutSection() {
  return (
    <SettingsPage title="关于">
      <div className="about-card">
        <div className="about-card__logo">
          <img src="/inkwise-icon.svg" width="100" height="100" alt="InkWise" />
        </div>
        <h3>InkWise · 墨智</h3>
        <p className="about-card__version">版本 0.0.1</p>
        <p className="about-card__desc">基于 React + TypeScript + Vite 构建，UI 设计参考 Reasonix 风格。</p>
        <div className="about-card__tech">
          <span>React 19</span>
          <span>TypeScript 6</span>
          <span>Vite 6</span>
          <span>Lucide Icons</span>
        </div>
      </div>
    </SettingsPage>
  );
}
