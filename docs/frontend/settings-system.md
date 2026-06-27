# 设置系统

> 版本: v1.4 | 位置: `src/components/settings/`

---

## 概述

提供应用所有可配置项的集中管理界面，涵盖外观、编辑器、AI 模型、快捷技能、快捷键、主题风格等。

## 设置项分类

```
settings/
├── SettingsPanel.tsx          # 设置面板主容器
├── SettingsPageLayout.tsx     # 页面布局（Tab 导航）
├── AppearanceSection.tsx      # 外观设置
├── EditorSection.tsx          # 编辑器设置
├── ModelsSection.tsx          # AI 模型提供商配置
├── SkillsSection.tsx          # 技能管理
├── QuickSkillsSection.tsx     # 快捷技能配置
├── WritingStylesSection.tsx   # 写作风格管理
├── ThemesSection.tsx          # 主题管理
├── ThemePicker.tsx            # 主题选择器
├── StylePanel.tsx             # 文风面板
├── PlatformsSection.tsx       # 发布平台配置
├── ShortcutsSection.tsx       # 快捷键配置
├── AboutSection.tsx           # 关于页面
└── settingsHelpers.tsx        # 辅助函数
```

## 数据存储

- 通过 `useGlobalAIConfig` hook 读写全局配置
- AI 提供商配置存储在 `lib/config/globalAIConfig.ts`
- 主题配置由 `themeStore`（Zustand）管理
- 快捷技能通过事件总线同步到全局状态
