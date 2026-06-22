#!/bin/sh
# Setup git hooks by copying from scripts/ to .git/hooks/
echo "🔗 设置 Git hooks…"
cp "$(dirname "$0")/pre-commit.sh" "$(dirname "$0")/../.git/hooks/pre-commit"
chmod +x "$(dirname "$0")/../.git/hooks/pre-commit"
echo "✅ pre-commit hook 已安装"
