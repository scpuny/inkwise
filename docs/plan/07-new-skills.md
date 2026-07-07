# 07 — 新技能注册

> 关联: 03-incremental-scanning.md, 06-context-planner.md

---

## 技能 1：项目变动报告

利用增量扫描和 Context Planner，实现"写一篇关于今天项目变动的文章"。

### Skill 定义（Rust `builtin_skills()` 新增）

```rust
Skill {
    name: "project-changelog".into(),
    description: "根据项目 Git / 文件变更生成项目变动报告".into(),
    body: "# 项目变动报告\n\n## 任务\n根据提供的项目变更信息，生成一份清晰的项目变动报告。\n\n## 报告结构\n1. 变更概览：修改文件数、增删行数、涉及模块\n2. 关键变更详解：每个文件/函数的具体改动\n3. 影响分析：变更波及了哪些上下游模块\n4. 风险提示：高复杂度区域变更\n5. 建议下一步\n\n## 写作要求\n- 面向技术团队，语言直接精炼\n- 每个变更点标注函数/类名和文件路径\n- 用代码片段说明关键改动\n- 避免罗列废话统计".into(),
    scope: SkillScope::Builtin,
    path: "(builtin)".into(),
    run_as: RunAs::Subagent,
    allowed_tools: vec![
        "read_document".into(),
        "write_document".into(),
        "search_git_diff".into(),
        "get_symbol_detail".into(),
    ],
    model: None,
    effort: Some("high".into()),
    enabled: true,
}
```

### 前端 WritingSkill 注册

```typescript
builtin("changelog", {
  name: "项目变动报告",
  description: "根据今日代码变更生成项目进展报告",
  icon: "📋",
  scope: "full",
  contextSources: [
    { type: "project", label: "关联项目目录", required: true },
  ],
  configs: {
    writing: {
      systemPrompt: `你是一个项目变动的分析专家。根据提供的 Git diff 和 AST 影响分析，生成清晰的项目变动报告。

## 报告结构
1. 变更概览（修改文件数、增删行数、影响的功能模块）
2. 关键变更详解（每个重要变更：改了什么文件、改了什么函数/符号、为什么改）
3. 影响分析（变更波及了哪些上下游模块/函数）
4. 风险提示（高复杂度区域的变更需要关注）
5. 建议（下一步可以做什么）

## 写作要求
- 面向技术团队，语言直接精炼
- 每个变更点标注对应的函数/类名和文件路径
- 用代码片段说明关键改动
- 避免罗列废话统计`,
      temperature: 0.4,
      maxTokens: 4096,
    },
  },
  dimensions: [
    { name: "正式度", value: 6 },
    { name: "修辞密度", value: 4 },
    { name: "叙事性", value: 3 },
  ],
});
```

---

## 技能 2：项目结构导读

适合新人接手项目时生成项目导读。

```typescript
builtin("project-intro", {
  name: "项目导读",
  description: "生成项目的结构导读，适合新人快速了解",
  icon: "🗺️",
  scope: "full",
  contextSources: [
    { type: "project", label: "关联项目目录", required: true },
  ],
  configs: {
    writing: {
      systemPrompt: `你是一个经验丰富的技术文档作者。根据提供的项目信息，生成一份项目结构导读。

## 内容要求
1. 一句话概括项目定位
2. 技术栈一览（语言、框架、数据库、构建工具）
3. 核心模块与目录职责（每个一级目录一句话说明）
4. 关键入口文件说明
5. 常见开发流程（如何启动、测试、构建）
6. 代码组织规范

## 格式
Markdown，简洁的分点格式，每个点 1-3 行`,
      temperature: 0.3,
    },
  },
  dimensions: [
    { name: "正式度", value: 7 },
    { name: "修辞密度", value: 3 },
    { name: "叙事性", value: 3 },
  ],
});
```

---

## 技能 3：代码影响评估

修改一个函数后，评估影响了哪些其他模块。

```typescript
builtin("impact-analysis", {
  name: "变更影响评估",
  description: "分析代码变更的影响范围，识别可能受影响的模块",
  icon: "🔍",
  scope: "full",
  contextSources: [
    { type: "project", label: "关联项目目录", required: true },
  ],
  configs: {
    writing: {
      systemPrompt: `你是一个资深的代码审查专家。分析代码变更的影响范围。

## 输出格式
1. 变更核心（改了哪里、改了什么）
2. 直接影响（同一模块内依赖它的函数/类）
3. 间接影响（其他模块调用受影响函数的地方）
4. 风险评分（低/中/高）+ 原因
5. 测试建议

## 规则
- 每个影响点标注文件路径和函数名
- 对高风险变更给出具体建议`,
      temperature: 0.3,
    },
  },
  dimensions: [
    { name: "正式度", value: 7 },
    { name: "修辞密度", value: 4 },
    { name: "叙事性", value: 2 },
  ],
});
```

---

## 技能注册位置

| 注册位置 | 方式 | 文件 |
|---------|------|------|
| Rust `builtin_skills()` | 新增 struct 项 | `src-tauri/src/skill.rs` |
| 前端 `getBuiltinSkills()` | 新增 `builtin()` 调用 | `src/lib/ai/writingSkill/builtins.ts` |
| 前端 `getAllBuiltinSkills()` | 自动包含（无需修改） | `src/lib/ai/writingSkill/builtins.ts` |

---

## Context Plan 联动

新技能需要 Context Planner 配合才能发挥全部价值：

```
项目变动报告 → Context Planner 自动识别意图
    ↓
为 "project_changelog" 意图注入 git_diff + changed_symbols
    ↓
Agent 执行 skill body + 精准上下文 → 高质量报告

变更影响评估 → Context Planner 注入调用链信息
    ↓
Agent 获得 caller/callee 关系 → 精确影响半径
```
