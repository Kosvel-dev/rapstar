import { extractRapLines } from "@/lib/artist/cleanLyrics";

const STOPWORDS = new Set([
  "の",
  "に",
  "は",
  "が",
  "を",
  "で",
  "と",
  "て",
  "た",
  "だ",
  "な",
  "る",
  "れ",
  "い",
  "う",
  "お",
  "か",
  "も",
  "よ",
  "ね",
  "さ",
  "し",
  "ん",
  "ま",
  "me",
  "my",
  "the",
  "and",
  "you",
  "it",
  "to",
  "in",
  "on",
  "ya",
  "ah",
  "oh",
  "yeah",
  "like",
  "dont",
  "im",
  "i",
  "a",
]);

export const ANTI_REPETITION_RULES = `【語彙の多様性 — 厳守】
- 同じ単語・同じフレーズを使い回さない（Hook/サビで意図的な反復は最大2回まで）
- 韻候補語は発想用。行末に語を足す・当て字漢字（艾・亜依等）・単独 I/AI/アア は禁止
- 2行以上、語順まで同じフレーズを繰り返さない
- 「〜して〜」「〜の中で〜」など同型の言い回しを3行連続で書かない
- 各行で比喩・動作・場所・情景を変え、語彙を広げる`;

export type OveruseReport = {
  words: { term: string; count: number }[];
  phrases: { term: string; count: number }[];
  duplicateLines: string[];
  isOverused: boolean;
};

function tokenizeLine(line: string): string[] {
  return line
    .replace(/[^\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fffA-Za-z0-9]+/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t.toLowerCase()));
}

function wordThreshold(lineCount: number): number {
  if (lineCount <= 8) return 3;
  if (lineCount <= 24) return 4;
  return 5;
}

function findRepeatedPhrases(lines: string[]): { term: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const line of lines) {
    const cleaned = line.replace(
      /[^\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fffA-Za-z0-9]/g,
      "",
    );
    const seenInLine = new Set<string>();
    const minLen = cleaned.length >= 14 ? 6 : 5;
    const maxLen = Math.min(14, cleaned.length);

    for (let len = maxLen; len >= minLen; len--) {
      for (let i = 0; i <= cleaned.length - len; i++) {
        const sub = cleaned.slice(i, i + len);
        if (seenInLine.has(sub)) continue;
        seenInLine.add(sub);
        counts.set(sub, (counts.get(sub) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, 12)
    .map(([term, count]) => ({ term, count }));
}

export function analyzeOveruse(lyrics: string): OveruseReport {
  const lines = extractRapLines(lyrics);
  const wordCounts = new Map<string, number>();

  for (const line of lines) {
    for (const token of tokenizeLine(line)) {
      wordCounts.set(token, (wordCounts.get(token) ?? 0) + 1);
    }
  }

  const threshold = wordThreshold(lines.length);
  const words = [...wordCounts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([term, count]) => ({ term, count }));

  const phrases = findRepeatedPhrases(lines);

  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    const norm = line.replace(/\s+/g, " ").trim();
    if (norm.length >= 8) {
      lineCounts.set(norm, (lineCounts.get(norm) ?? 0) + 1);
    }
  }
  const duplicateLines = [...lineCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([term]) => term);

  return {
    words,
    phrases,
    duplicateLines,
    isOverused:
      words.length > 0 || phrases.length > 0 || duplicateLines.length > 0,
  };
}

export function buildAvoidListPrompt(lyrics: string): string {
  const report = analyzeOveruse(lyrics);
  if (!report.isOverused) return "";

  const parts: string[] = ["## 使いすぎ — このパートでは避ける・言い換える"];

  if (report.words.length > 0) {
    parts.push(
      `- 単語: ${report.words.map((w) => `${w.term}(${w.count}回)`).join("、")}`,
    );
  }
  if (report.phrases.length > 0) {
    parts.push(
      `- フレーズ: ${report.phrases.map((p) => `「${p.term}」`).join("、")}`,
    );
  }
  if (report.duplicateLines.length > 0) {
    parts.push(
      `- 同文行を再使用しない: ${report.duplicateLines.slice(0, 3).join(" / ")}`,
    );
  }

  parts.push("- 上記に似た言い回しも新しい語彙・比喩で書く");
  return parts.join("\n");
}

/** 直前パートの流れだけ渡す（全文コピーを防ぐ） */
export function recentContextBlock(lyrics: string, maxLines = 6): string {
  const lines = extractRapLines(lyrics);
  if (lines.length === 0) return "";
  const tail = lines.slice(-maxLines);
  return [
    "## 直前の流れ（参考のみ — フレーズのコピー禁止）",
    tail.join("\n"),
  ].join("\n");
}

export function overuseSummaryForPrompt(report: OveruseReport): string {
  if (!report.isOverused) return "";

  const items = [
    ...report.words.slice(0, 8).map((w) => w.term),
    ...report.phrases.slice(0, 5).map((p) => p.term),
  ];
  return items.length > 0
    ? `使いすぎの語句: ${items.join("、")}`
    : "同じフレーズ・同文行の繰り返し";
}
