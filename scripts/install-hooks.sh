#!/usr/bin/env bash
# ================================================================
# install-hooks.sh — 安装 git post-merge hook 用于代码审核触发
# ================================================================
set -euo pipefail

HOOKS_DIR="$(cd "$(dirname "$0")/.." && pwd)/.git/hooks"
HOOK_FILE="$HOOKS_DIR/post-merge"

cat > "$HOOK_FILE" << 'HOOK'
#!/usr/bin/env bash
# post-merge hook — pull/merge 后自动检测 Codex 提交并输出审核摘要
set -euo pipefail

# 只对 main 分支生效
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ]; then
  exit 0
fi

# 检测最近是否有 Codex 的提交
RECENT_CODEX=$(git log -1 --format="%an" 2>/dev/null || echo "")
if [ "$RECENT_CODEX" = "codex" ] || [ "$RECENT_CODEX" = "Codex" ]; then
  echo ""
  echo "╔══════════════════════════════════════════════╗"
  echo "║  检测到 Codex 提交，运行代码审核...          ║"
  echo "╚══════════════════════════════════════════════╝"
  echo ""

  # 运行审核脚本
  SCRIPTS_DIR="$(cd "$(dirname "$0")/../.." && pwd)/scripts"
  if [ -f "$SCRIPTS_DIR/review-latest.sh" ]; then
    bash "$SCRIPTS_DIR/review-latest.sh" --since 1
    echo ""
    echo "审核报告已生成。在 ticket/ 目录查看。"
  fi
fi
HOOK

chmod +x "$HOOK_FILE"
echo "✓ post-merge hook 已安装: $HOOK_FILE"
