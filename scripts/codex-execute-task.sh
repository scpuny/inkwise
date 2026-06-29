#!/usr/bin/env bash
# ================================================================
# codex-execute-task.sh — 派发任务给 Codex 执行
# 用法: bash scripts/codex-execute-task.sh <ticket-id>
# 示例: bash scripts/codex-execute-task.sh 002
#
# 流程: 生成 prompt → 派发给 codex exec → 等待完成 → 记录结果
# ================================================================
set -euo pipefail

TICKET_ID="$1"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TICKET_FILE="$PROJECT_ROOT/ticket/$(ls "$PROJECT_ROOT/ticket/" | grep "^0${TICKET_ID}-" || ls "$PROJECT_ROOT/ticket/" | grep "^${TICKET_ID}-" || true)"

if [ ! -f "$TICKET_FILE" ]; then
  echo "❌ 未找到 Ticket #$TICKET_ID"
  ls "$PROJECT_ROOT/ticket/" | grep -E '^[0-9]+-'
  exit 1
fi

TICKET_NAME=$(basename "$TICKET_FILE" .md)
BRANCH_NAME="fix/${TICKET_NAME}"
TASK_FILE="$PROJECT_ROOT/ticket/assignments/${TICKET_NAME}.prompt.md"
RESULT_FILE="$PROJECT_ROOT/ticket/assignments/${TICKET_NAME}.result.md"

echo "╔══════════════════════════════════════════════╗"
echo "║  InkWise → Codex 任务派发                    ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
echo "Ticket: $TICKET_NAME"
echo "Branch: $BRANCH_NAME"
echo ""

# 1. 先检查是否已经生成 prompt，没有则生成
if [ ! -f "$TASK_FILE" ]; then
  echo "→ 生成 task prompt..."
  bash "$PROJECT_ROOT/scripts/generate-codex-task.sh" "$TICKET_ID"
fi

# 2. 创建分支（基于最新的 main）
cd "$PROJECT_ROOT"
echo "→ 创建分支: $BRANCH_NAME"
git fetch origin main 2>/dev/null || true
git checkout main 2>/dev/null || true
git pull origin main 2>/dev/null || true
# 如果分支已存在，先删掉重建（确保基于最新 main）
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
  git branch -D "$BRANCH_NAME"
fi
git checkout -b "$BRANCH_NAME"
echo ""

# 3. 更新 TASK-BOARD 为 in-progress
sed -i '' "s/| ⏳ pending | #${TICKET_ID}/| 🔧 in-progress | #${TICKET_ID}/" "$PROJECT_ROOT/ticket/TASK-BOARD.md" 2>/dev/null || true

echo "→ 派发给 Codex 执行..."
echo "   命令: codex exec --cd \"$PROJECT_ROOT\" -s workspace-write < \"$TASK_FILE\""
echo ""
echo "   开始时间: $(date '+%H:%M:%S')"
echo "   ────────────────────────────────────────"

# 3. 执行 Codex
cd "$PROJECT_ROOT"
SESSION_ID=$(date +%s)-$$
codex exec --cd "$PROJECT_ROOT" -s workspace-write -o "$RESULT_FILE" < "$TASK_FILE" 2>&1 || true
CODEX_EXIT=$?

echo "   ────────────────────────────────────────"
echo "   结束时间: $(date '+%H:%M:%S')"
echo "   Codex 退出码: $CODEX_EXIT"
echo ""

# 4. 注册 session 到 Codex Desktop（修复 source 字段使其可见）
LATEST_SESSION=$(find ~/.codex/sessions -name "*.jsonl" -newer "$PROJECT_ROOT/ticket/INDEX.md" 2>/dev/null | sort | tail -1 2>/dev/null || true)
if [ -n "$LATEST_SESSION" ] && [ -f "$LATEST_SESSION" ]; then
  SESSION_ID_EXEC=$(head -1 "$LATEST_SESSION" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.loads(sys.stdin.readline())
    payload = d.get('payload', {})
    print(payload.get('id', ''))
except:
    print('')
" 2>/dev/null || true)
  if [ -n "$SESSION_ID_EXEC" ]; then
    # Codex Desktop 过滤 source='exec' 的会话，改为 'unknown' 使其可见
    sqlite3 ~/.codex/state_5.sqlite "UPDATE threads SET source='unknown' WHERE id='$SESSION_ID_EXEC' AND source='exec';" 2>/dev/null || true
    NOW_ISO=$(date -u +"%Y-%m-%dT%H:%M:%S.000000Z")
    echo "→ 注册 session ($SESSION_ID_EXEC) 到 Codex Desktop..."
    echo "$(python3 -c "
import json
print(json.dumps({'id': '$SESSION_ID_EXEC', 'thread_name': 'fix: ${TICKET_NAME}', 'updated_at': '$NOW_ISO'}))
")" >> ~/.codex/session_index.jsonl
    echo "   ✅ 现在可以在 Codex Desktop 中看到此会话"
  fi
fi

if [ $CODEX_EXIT -eq 0 ]; then
  # 5. 更新 TASK-BOARD 为 fixed
  sed -i '' "s/| 🔧 in-progress | #${TICKET_ID}/| ✅ fixed | #${TICKET_ID}/" "$PROJECT_ROOT/ticket/TASK-BOARD.md" 2>/dev/null || true
  echo "✅ Codex 执行完成！任务已标记为 fixed。"
  echo "   结果日志: $RESULT_FILE"
else
  echo "⚠️  Codex 执行异常（退出码: $CODEX_EXIT）"
  echo "   请检查输出后手动更新 TASK-BOARD。"
fi

echo ""
echo "查看最新状态: cat ticket/TASK-BOARD.md"
