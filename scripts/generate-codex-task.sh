#!/usr/bin/env bash
# ================================================================
# generate-codex-task.sh — 生成供 Codex 执行的任务 prompt 文件
# 用法: bash scripts/generate-codex-task.sh <ticket-id>
# 示例: bash scripts/generate-codex-task.sh 002
# ================================================================
set -euo pipefail

TICKET_ID="$1"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TICKET_FILE="$PROJECT_ROOT/ticket/$(ls "$PROJECT_ROOT/ticket/" | grep "^0${TICKET_ID}-" || ls "$PROJECT_ROOT/ticket/" | grep "^${TICKET_ID}-" || true)"

if [ ! -f "$TICKET_FILE" ]; then
  echo "❌ 未找到 Ticket #$TICKET_ID"
  echo "   查找路径: $PROJECT_ROOT/ticket/"
  echo "   可用文件:"
  ls "$PROJECT_ROOT/ticket/" | grep -E '^[0-9]+-'
  exit 1
fi

TICKET_NAME=$(basename "$TICKET_FILE" .md)
TASK_FILE="$PROJECT_ROOT/ticket/assignments/${TICKET_NAME}.prompt.md"

# 读取 ticket 的关键信息
SEVERITY=$(grep -m1 '^\*\*严重程度\*\*' "$TICKET_FILE" | sed 's/.*\*\*: //;s/\*\*$//;s/\*\*//' || echo "未知")
SCOPE=$(grep -m1 '^\*\*影响范围\*\*' "$TICKET_FILE" | sed 's/.*\*\*: //' || echo "未知")

# 读取问题描述（提取 ## 问题描述 和 ## 修复建议 之间的内容）
DESCRIPTION=$(awk '/^## 问题描述/{flag=1; next} /^## 修复建议/{flag=0} flag' "$TICKET_FILE")
FIX_SUGGESTION=$(awk '/^## 修复建议/{flag=1; next} /^## (影响文件|验收标准)/{flag=0} flag' "$TICKET_FILE")
ACCEPTANCE=$(awk '/^## 验收标准/{flag=1; next} /^## /{flag=0} flag' "$TICKET_FILE")

# 获取 diff 上下文（影响文件的最近变更）
IMPACTED_FILES=$(sed -n '/^## 影响文件/,/^## /p' "$TICKET_FILE" | grep -- '- `' | sed 's/- `//;s/`.*//' || true)

cat > "$TASK_FILE" << PROMPT
# Task: $(head -1 "$TICKET_FILE" | sed 's/^# //')

**严重程度**: $SEVERITY
**Ticket**: $TICKET_NAME
**生成时间**: $(date '+%Y-%m-%d %H:%M')

---

## Background

You are Codex, an AI coding agent working on the **InkWise** project — an AI-powered desktop writing app (React 19 + TypeScript 6 + Vite 6 + Tauri 2 + Rust).

PROMPT

# 添加项目上下文
cat >> "$TASK_FILE" << PROMPT

## Project Context

Key architectural rules:
1. **Dual-environment**: All Tauri IPC must use \`invokeOrFallback()\` pattern from \`src/lib/bridge/tauri.ts\`
2. **CSS**: Single \`src/styles.css\`, BEM naming, CSS variable theming. No inline styles except dynamic vars.
3. **State**: Zustand stores for UI state (\`src/store/\`), Rust DataStore for JSON persistence, SQLite for new storage
4. **Error handling**: Rust Tauri commands return \`Result<T, String>\`. Frontend must handle both Tauri and browser fallback.

PROMPT

# 任务详细描述
cat >> "$TASK_FILE" << PROMPT
## Problem

$DESCRIPTION

## Fix Guidance

$FIX_SUGGESTION

## Impacted Files

$(if [ -n "$IMPACTED_FILES" ]; then
  echo "$IMPACTED_FILES"
else
  grep -- '- `' "$TICKET_FILE" | sed 's/- `/* /;s/`//g'
fi)

## Acceptance Criteria

$ACCEPTANCE

---

## Workflow

1. Read the full ticket at \`ticket/$TICKET_NAME.md\` for complete context
2. Create a branch: \`fix/${TICKET_NAME}\`
   \`\`\`bash
   git checkout -b fix/${TICKET_NAME}
   \`\`\`
3. Implement the fix following the project conventions
4. After implementation, run \`npm run typecheck\` for TypeScript validation
5. Commit with a clear message referencing this ticket:
   \`\`\`
   git add -A
   git commit -m "fix: ${TICKET_NAME}

   Ticket: #${TICKET_ID}"
   \`\`\`
6. Push the branch:
   \`\`\`
   git push origin fix/${TICKET_NAME}
   \`\`\`

## Completion

When done, append a \`## 修复记录\` section to \`ticket/$TICKET_NAME.md\`:
\`\`\`markdown
## 修复记录

**修复者**: Codex
**分支**: fix/${TICKET_NAME}
**日期**: $(date '+%Y-%m-%d')
**变更**: <简要描述做了什么>
**涉及文件**: <文件列表>
\`\`\`

Then update \`ticket/TASK-BOARD.md\` to mark this task as \`✅ fixed\`.
PROMPT

echo "✅ Codex task prompt 已生成: $TASK_FILE"
echo "   可以直接将此文件内容提供给 Codex 执行。"
echo ""
echo "   或运行: cat $TASK_FILE"
