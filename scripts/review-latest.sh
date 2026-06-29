#!/usr/bin/env bash
# ================================================================
# review-latest.sh — 检查 main 分支最近的 Codex 提交并生成审核报告
# 用法: bash scripts/review-latest.sh [--since <commits>]
# 默认检查最近 5 个 commit
# ================================================================
set -euo pipefail

SINCE="${2:-5}"
TICKET_DIR="$(cd "$(dirname "$0")/.." && pwd)/ticket"
REPORT_FILE="$TICKET_DIR/_review-$(date +%Y%m%d-%H%M).md"

echo "=== InkWise Code Review ==="
echo "检查最近 $SINCE 个 commit..."
echo ""

cd "$(dirname "$0")/.."

# 获取最近的 commits
git log HEAD~"$SINCE"..HEAD --format="%H|%an|%s" 2>/dev/null | while IFS='|' read -r hash author subject; do
  echo "Commit: ${hash:0:8} | $author | $subject"
done

echo ""
echo "--- 生成审核报告: $REPORT_FILE ---"

# 获取变更文件列表
CHANGED_FILES=$(git diff --name-only HEAD~"$SINCE" HEAD 2>/dev/null | sort -u || git log --name-only --format="" -n "$SINCE" | sort -u)

# 分析变更文件
RUST_FILES=$(echo "$CHANGED_FILES" | grep -E '\.rs$' || true)
TS_FILES=$(echo "$CHANGED_FILES" | grep -E '\.tsx?$' || true)
CSS_FILES=$(echo "$CHANGED_FILES" | grep -E '\.css$' || true)

# 检查清单
CHECKS=""

# Rust 安全检查
if [ -n "$RUST_FILES" ]; then
  for f in $RUST_FILES; do
    if [ -f "$f" ]; then
      UNWRAP_COUNT=$(grep -c '\.unwrap()' "$f" 2>/dev/null || echo 0)
      if [ "$UNWRAP_COUNT" -gt 0 ]; then
        CHECKS="$CHECKS
- [ ] $f: 含 $UNWRAP_COUNT 处 unwrap() — 是否必须？建议改为 map_err/传播"
      fi
    fi
  done
fi

# TypeScript any 检查
if [ -n "$TS_FILES" ]; then
  for f in $TS_FILES; do
    if [ -f "$f" ]; then
      ANY_COUNT=$(grep -c ': any' "$f" 2>/dev/null || echo 0)
      AS_ANY_COUNT=$(grep -c 'as any' "$f" 2>/dev/null || echo 0)
      TOTAL_ANY=$((ANY_COUNT + AS_ANY_COUNT))
      if [ "$TOTAL_ANY" -gt 0 ]; then
        CHECKS="$CHECKS
- [ ] $f: 含 $TOTAL_ANY 处 any 类型 — 是否可以用具体类型？"
      fi
    fi
  done
fi

# Tauri 命令检查（看看是否用了 invokeOrFallback）
if [ -n "$TS_FILES" ]; then
  for f in $TS_FILES; do
    if [ -f "$f" ]; then
      TRY_INVOKE=$(grep -c 'tryInvoke' "$f" 2>/dev/null || echo 0)
      if [ "$TRY_INVOKE" -gt 0 ]; then
        FALLBACK_COUNT=$(grep -c 'invokeOrFallback' "$f" 2>/dev/null || echo 0)
        # 检查 tryInvoke 是否被 try/catch 包裹
        UNPROTECTED=$((TRY_INVOKE - FALLBACK_COUNT))
        if [ "$UNPROTECTED" -gt 0 ]; then
          CHECKS="$CHECKS
- [ ] $f: tryInvoke $TRY_INVOKE 次中 $UNPROTECTED 次缺少 invokeOrFallback 或 try/catch"
        fi
      fi
    fi
  done
fi

# 空 catch 检查
if [ -n "$TS_FILES" ]; then
  for f in $TS_FILES; do
    if [ -f "$f" ]; then
      EMPTY_CATCH=$(grep -cE 'catch\s*\{\}' "$f" 2>/dev/null || echo 0)
      if [ "$EMPTY_CATCH" -gt 0 ]; then
        CHECKS="$CHECKS
- [ ] $f: 含 $EMPTY_CATCH 处空 catch {} — 需要评估是否合理"
      fi
    fi
  done
fi

# SQL 注入检查
if [ -n "$RUST_FILES" ]; then
  for f in $RUST_FILES; do
    if [ -f "$f" ]; then
      HAS_FORMAT_SQL=$(grep -cE 'format!.*execute\(' "$f" 2>/dev/null || echo 0)
      if [ "$HAS_FORMAT_SQL" -gt 0 ]; then
        CHECKS="$CHECKS
- [ ] $f: 使用 format! 拼接 SQL — 需确认使用了参数化查询"
      fi
    fi
  done
fi

# 写入报告
cat > "$REPORT_FILE" << EOF
# Code Review Report — $(date +%Y-%m-%d)

**审查范围**: 最近 $SINCE 个 commit
**变更文件数**: $(echo "$CHANGED_FILES" | wc -l | tr -d ' ')
**Rust 文件**: $(echo "$RUST_FILES" | wc -l | tr -d ' ')
**TypeScript 文件**: $(echo "$TS_FILES" | wc -l | tr -d ' ')

## 变更概要

\`\`\`
$(git log -n "$SINCE" --format="%h %an: %s")
\`\`\`

## 检查结果

### 变更文件

\`\`\`
$CHANGED_FILES
\`\`\`

${CHECKS:+### 发现问题

$CHECKS

_以上问题标记为 [ ] 待确认，建议逐个核实。_
}

${CHECKS:+### 结论

- 待确认问题数: $(echo "$CHECKS" | grep -c '\[ \]')
}

${CHECKS:-### 结论

- 本次提交未发现明显问题。}
EOF

echo "报告已生成: $REPORT_FILE"
echo ""
if [ -n "$CHECKS" ]; then
  echo "⚠️  发现以下待确认问题:"
  echo "$CHECKS"
else
  echo "✅ 本次未发现明显问题"
fi
