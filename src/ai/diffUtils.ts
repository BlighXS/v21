export interface DiffChunk {
  type: "add" | "remove" | "equal";
  lines: string[];
  startA: number;
  startB: number;
}

function computeLcs(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

function buildChunks(a: string[], b: string[]): DiffChunk[] {
  const dp = computeLcs(a, b);
  const chunks: DiffChunk[] = [];
  let i = a.length;
  let j = b.length;

  const ops: Array<{ type: "add" | "remove" | "equal"; lineA: number; lineB: number; text: string }> = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      ops.push({ type: "equal", lineA: i - 1, lineB: j - 1, text: a[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.push({ type: "add", lineA: i, lineB: j - 1, text: b[j - 1] });
      j--;
    } else {
      ops.push({ type: "remove", lineA: i - 1, lineB: j, text: a[i - 1] });
      i--;
    }
  }

  ops.reverse();

  let cur: DiffChunk | null = null;
  for (const op of ops) {
    if (!cur || cur.type !== op.type) {
      cur = { type: op.type, lines: [op.text], startA: op.lineA, startB: op.lineB };
      chunks.push(cur);
    } else {
      cur.lines.push(op.text);
    }
  }

  return chunks;
}

function collapseEqual(chunks: DiffChunk[], context = 3): DiffChunk[] {
  const result: DiffChunk[] = [];
  for (const chunk of chunks) {
    if (chunk.type !== "equal") {
      result.push(chunk);
      continue;
    }
    if (chunk.lines.length <= context * 2) {
      result.push(chunk);
      continue;
    }
    result.push({ ...chunk, lines: chunk.lines.slice(0, context) });
    result.push({ type: "equal", lines: ["..."], startA: chunk.startA + context, startB: chunk.startB + context });
    result.push({ ...chunk, lines: chunk.lines.slice(-context) });
  }
  return result;
}

export function generateDiff(original: string, updated: string, maxLines = 60): string {
  const aLines = original.split("\n");
  const bLines = updated.split("\n");

  if (aLines.length > 300 || bLines.length > 300) {
    return generateSimpleDiff(original, updated, maxLines);
  }

  const chunks = buildChunks(aLines, bLines);
  const collapsed = collapseEqual(chunks);

  const lines: string[] = [];
  for (const chunk of collapsed) {
    if (chunk.type === "equal") {
      for (const line of chunk.lines) {
        if (line === "...") {
          lines.push("  ...");
        } else {
          lines.push(`  ${line}`);
        }
      }
    } else if (chunk.type === "add") {
      for (const line of chunk.lines) lines.push(`+ ${line}`);
    } else {
      for (const line of chunk.lines) lines.push(`- ${line}`);
    }
    if (lines.length > maxLines) {
      lines.push(`  ...[diff truncado — ${chunks.length} seções de mudança]`);
      break;
    }
  }

  if (lines.length === 0) return "(sem diferenças detectadas)";
  return lines.join("\n");
}

function generateSimpleDiff(original: string, updated: string, maxLines: number): string {
  const aLines = original.split("\n");
  const bLines = updated.split("\n");
  const lines: string[] = [];

  const maxLen = Math.max(aLines.length, bLines.length);
  let diffCount = 0;

  for (let i = 0; i < maxLen && lines.length < maxLines; i++) {
    const a = aLines[i];
    const b = bLines[i];
    if (a === b) {
      if (diffCount > 0) {
        lines.push(`  ${a ?? ""}`);
      }
    } else {
      diffCount++;
      if (a !== undefined) lines.push(`- ${a}`);
      if (b !== undefined) lines.push(`+ ${b}`);
    }
  }

  if (lines.length === 0) return "(sem diferenças detectadas)";
  return lines.join("\n");
}

export function countChangedLines(original: string, updated: string): { added: number; removed: number } {
  const aSet = original.split("\n");
  const bSet = updated.split("\n");
  let added = 0;
  let removed = 0;

  const chunks = aSet.length <= 300 && bSet.length <= 300
    ? buildChunks(aSet, bSet)
    : [];

  if (chunks.length > 0) {
    for (const c of chunks) {
      if (c.type === "add") added += c.lines.length;
      if (c.type === "remove") removed += c.lines.length;
    }
  } else {
    added = bSet.filter(l => !aSet.includes(l)).length;
    removed = aSet.filter(l => !bSet.includes(l)).length;
  }

  return { added, removed };
}
