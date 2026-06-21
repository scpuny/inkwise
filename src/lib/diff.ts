// diff.ts — 简单的行级 diff 算法，用于 Agent 对比视图

export interface DiffLine {
  type: "same" | "add" | "remove";
  text: string;
  lineNum: number;
}

/**
 * 计算两段文本的行级差异
 * 基于最长公共子序列（LCS）算法
 */
export function computeDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  // Build LCS table
  const m = beforeLines.length;
  const n = afterLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (beforeLines[i - 1] === afterLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find diff
  const result: DiffLine[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
      result.push({ type: "same", text: beforeLines[i - 1], lineNum: i - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.push({ type: "add", text: afterLines[j - 1], lineNum: j - 1 });
      j--;
    } else if (i > 0) {
      result.push({ type: "remove", text: beforeLines[i - 1], lineNum: i - 1 });
      i--;
    }
  }

  return result.reverse();
}

/**
 * 简单的单行文本差异（inline diff）
 * 返回差异片段数组
 */
export interface DiffSegment {
  type: "same" | "add" | "remove";
  text: string;
}

export function computeInlineDiff(before: string, after: string): DiffSegment[] {
  if (before === after) return [{ type: "same", text: before }];

  const segments: DiffSegment[] = [];
  let i = 0, j = 0;

  // Find common prefix
  while (i < before.length && j < after.length && before[i] === after[j]) {
    i++;
    j++;
  }

  if (i > 0) {
    segments.push({ type: "same", text: before.slice(0, i) });
  }

  // Find common suffix
  let bi = before.length - 1;
  let aj = after.length - 1;
  while (bi >= i && aj >= j && before[bi] === after[aj]) {
    bi--;
    aj--;
  }

  // Middle part is different
  const beforeMid = before.slice(i, bi + 1);
  const afterMid = after.slice(j, aj + 1);

  if (beforeMid) {
    segments.push({ type: "remove", text: beforeMid });
  }
  if (afterMid) {
    segments.push({ type: "add", text: afterMid });
  }

  // Common suffix
  if (bi + 1 < before.length) {
    segments.push({ type: "same", text: before.slice(bi + 1) });
  }

  return segments;
}
