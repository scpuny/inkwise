# 10 — 文章主题系统缺陷与重构方案

> 关联: INDEX.md, 09-skill-system-review.md

---

## 一、当前缺陷

### 🔴 缺陷 1：类型字段不一致

```typescript
interface ArticleThemeVars {
  fontFamily: string;         // 字符串
  fontSize: string;           // 字符串（语义是数字 px）
  lineHeight: number;         // 数字（唯一的 number）
  paragraphGap: string;       // 字符串（语义是数字 em）
  maxWidth: string;           // 字符串（语义是数字 px）
  // ...其他全是 string
}
```

**问题**：`fontSize` 的 CSS 单位是 px，但类型声明中没说清楚。`lineHeight` 是唯一的 `number`，其余都是 `string`。语义上大部分 "px"/"em" 值应该用 `number`，在渲染时拼接单位。

### 🔴 缺陷 2：平台分布严重不均

```
general:   14 个主题
wechat:     3 个
zhihu:      3 个
toutiao:    2 个
medium:     1 个
jianshu:    1 个
csdn:       1 个
```

大多数平台只有 1-2 个主题，`platform` 抽象的价值被稀释。14 个通用主题本身就是一个大杂烩——从极简白 → 暖陶米白 → 琥珀橙 → 健康绿，风格跨度大但都归为 "general"。

### 🔴 缺陷 3：BASE_VARS 散布 + 手动覆盖易错

每个主题手动 spread + override：

```typescript
vars: { ...BASE_VARS,
  bgColor: '#1a1a2e', textColor: '#e0e0e0',
  headingColor: '#ffffff', codeBg: '#16213e',
  // 再次漏掉某个字段编译器不会报错
}
```

新增字段到 `BASE_VARS` 时，已有主题不会自动得到新字段。

### 🔴 缺陷 4：颜色值无类型约束

所有颜色是原始字符串：

```typescript
bgColor: '#ffffff'
```

没有 `ColorHex` 类型约束、没有 CSS 命名颜色校验、也没有语义化 token（如 `--color-surface`）。

### 🔴 缺陷 5：主题和技能系统不关联

文章主题（排版样式）和写作技能（内容风格）是完全独立的概念，但在用户体验上高度相关——"学术严谨"技能应该默认勾选"典雅"主题。当前没有任何机制联动。

### 🔴 缺陷 6：自定义主题只存在 localStorage

```typescript
const CUSTOM_THEMES_KEY = 'inkwise-custom-article-themes';
```
自定义主题无法跨设备同步，也无法和 Rust 后端持久化。

---

## 二、重构方案

### 核心思路：分层解耦 + 语义化类型 + 技能主题联动

```
User Story: "选择学术技能 → 自动推荐典雅主题"
            "选择自媒体爆款 → 自动推荐头条默认主题"
            
后台逻辑: skill.metadata.recommendedThemeId → auto-select
```

### 第 1 步：完善主题变量类型

```typescript
// 语义化单位类型
export type PxValue = number;        // 渲染时拼 "px"
export type EmValue = number;        // 渲染时拼 "em"
export type HexColor = string;       // 运行时校验 #xxx / #xxxxxx 格式

export interface ArticleThemeVarsTyped {
  fontFamily: string;
  fontSize: PxValue;                 // 数字，拼 "px"
  lineHeight: number;                // 无单位
  paragraphGap: EmValue;             // 数字，拼 "em"
  maxWidth: PxValue;                 // 数字，拼 "px"
  textColor: HexColor;
  bgColor: HexColor;
  headingColor: HexColor;
  linkColor: HexColor;
  codeBg: HexColor;
  codeText: HexColor;
  blockquoteBorder: HexColor;
  blockquoteBg: HexColor;
  // 可选增强
  accentColor?: HexColor;
  strongColor?: HexColor;
  markBg?: HexColor;
  hrColor?: HexColor;
  pageBg?: string;                   // 可以是渐变/图案
  pageBgSize?: string;
  headingVariant?: 'ribbon';
  headingBg?: string;
  headingText?: HexColor;
  headingLine?: HexColor;
}

// 渲染时自动拼单位
export function renderThemeVars(vars: ArticleThemeVarsTyped): Record<string, string> {
  return {
    '--font-family': vars.fontFamily,
    '--font-size': vars.fontSize + 'px',
    '--line-height': String(vars.lineHeight),
    '--paragraph-gap': vars.paragraphGap + 'em',
    '--max-width': vars.maxWidth + 'px',
    // ...
  };
}
```

### 第 2 步：主题分组扁平化

```typescript
interface ThemeCategory {
  id: string;
  label: string;
  icon: string;
  themes: ArticleTheme[];
}
```

改为不按平台分组，按**风格标签**分组：

```typescript
const THEME_CATEGORIES: ThemeCategory[] = [
  {
    id: "minimal",
    label: "简约",
    icon: "⬜",
    themes: [
      { id: "clean", label: "极简白", tags: ["简约"], ... },
      { id: "night", label: "暗色护眼", tags: ["暗色"], ... },
    ],
  },
  {
    id: "warm",
    label: "暖色",
    icon: "🟨",
    themes: [
      { id: "paper", label: "纸墨", tags: ["暖色"], ... },
      { id: "warm-clay", label: "暖陶米白", tags: ["暖色"], ... },
    ],
  },
  // 按风格而非平台组织
];
```

**平台兼容性**改为主题元数据字段：

```typescript
interface ArticleTheme {
  id: string;
  label: string;
  desc: string;
  tags: string[];
  platforms: string[];     // ["general", "wechat"] — 兼容哪些平台
  vars: ArticleThemeVarsTyped;
}
```

这样一个新主题只需声明兼容哪些平台，不用为每个平台分别定义。

### 第 3 步：技能 ↔ 主题联动

在技能定义中增加可选的主题推荐：

```typescript
// UnifiedSkill 新增
interface UnifiedSkill {
  // ...原有字段
  recommendedThemeId?: string;   // 使用该技能时推荐的主题 ID
}
```

ContextPlanner 识别技能后，可返回推荐主题作为副产品：

```typescript
function getRecommendedTheme(skill: UnifiedSkill): string | null {
  return skill.recommendedThemeId ?? null;
}
```

内置技能的主题推荐映射：

| 技能 | 推荐主题 |
|------|---------|
| 学术严谨 | 典雅 (elegant) |
| 博客口语 | 现代 (modern) |
| 自媒体爆款 | 头条默认 (toutiao-default) |
| 创意文学 | 暖陶米白 (warm-clay) |
| 技术教程 | 极简白 (clean) |
| 产品文档 | 现代 (modern) |
| 书评影评 | 纸墨 (paper) |
| 商业文案 | 杂志红 (magazine) |

### 第 4 步：极端主题精简

当前 25 个主题中有不同平台的重复变体。重构后合并同质主题：

```
重构前:  clean(极简白) + wechat-default(微信默认) + zhihu-default(知乎默认)
          这三个的核心差异只有 fontSize/maxWidth
重构后:  clean(极简白) 统一，platforms: ["general", "wechat", "zhihu"]
          用 variant 参数覆盖 fontSize/maxWidth:
          clean@wechat: { fontSize: 17, maxWidth: 660 }
          clean@zhihu:  { fontSize: 15, maxWidth: 768 }
```

```typescript
interface ArticleTheme {
  id: string;
  label: string;
  desc: string;
  tags: string[];
  platforms: string[];
  vars: ArticleThemeVarsTyped;
  platformOverrides?: Record<string, Partial<ArticleThemeVarsTyped>>;
}

function resolveThemeVars(theme: ArticleTheme, platform: string): ArticleThemeVarsTyped {
  const overrides = theme.platformOverrides?.[platform] ?? {};
  return { ...theme.vars, ...overrides };
}
```

主题总数从 25 个精简到 ~12 个核心主题 + 平台变体参数。

---

## 三、实施步骤

| 步骤 | 内容 | 涉及文件 | 量级 |
|------|------|---------|------|
| 1 | 完善类型定义（`PxValue`/`HexColor`/`platforms`） | `articleThemes.ts` | 小 |
| 2 | 定义 `renderThemeVars()` 统一单位拼接 | 新函数 | 小 |
| 3 | 按风格标签重组主题分组 | `articleThemes.ts` | 中 |
| 4 | 合并同质主题为平台变体（25→12） | `articleThemes.ts` | 中 |
| 5 | 技能 ↔ 主题联动：`recommendedThemeId` | `UnifiedSkill`, `plan.ts` | 小 |
| 6 | 自定义主题支持 Rust 后端持久化 | `store.rs`, `crud.ts` | 中 |
