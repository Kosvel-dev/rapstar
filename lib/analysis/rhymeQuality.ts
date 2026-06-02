import type { LineAnalysis } from "./types";

/** 末尾N文字の Jaccard 係数（論文 suffix_penalty ベース） */
export function suffixJaccard(a: string, b: string, tailLen = 5): number {
  const ta = a.slice(-tailLen);
  const tb = b.slice(-tailLen);
  if (!ta || !tb) return 0;

  const setA = new Set(ta.split(""));
  const setB = new Set(tb.split(""));
  let intersection = 0;
  for (const ch of setA) {
    if (setB.has(ch)) intersection++;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/** 母音列末尾の一致モーラ数 */
export function matchingVowelTailLen(a: string, b: string, max = 5): number {
  if (!a || !b) return 0;
  let count = 0;
  const limit = Math.min(max, a.length, b.length);
  for (let i = 1; i <= limit; i++) {
    if (a.at(-i) === b.at(-i)) count++;
    else break;
  }
  return count;
}

export type RhymeQualityMetrics = {
  /** 脚韻の平均長さスコア (0-100, 5モーラ以上=高) */
  rhymeLengthScore: number;
  /** 表層重複の少なさ (0-100, 高=良い) */
  lowDuplicationScore: number;
  /** 行末反復ペナルティ平均 (0-1, 低=良い) */
  avgSuffixSimilarity: number;
  /** 8-16モーラ範囲内の行の割合 (0-100) */
  moraRangeScore: number;
  /** 隣接行モーラ差≤4の割合 (0-100) */
  moraBalanceScore: number;
  /** 論文ベース総合品質 (0-100) */
  overallQuality: number;
};

const MORA_MIN = 8;
const MORA_MAX = 16;
const MORA_DELTA_MAX = 4;

/** 論文 P9-3 報酬関数を参考にした品質指標 */
export function computeRhymeQuality(lines: LineAnalysis[]): RhymeQualityMetrics {
  if (lines.length === 0) {
    return {
      rhymeLengthScore: 0,
      lowDuplicationScore: 0,
      avgSuffixSimilarity: 0,
      moraRangeScore: 0,
      moraBalanceScore: 0,
      overallQuality: 0,
    };
  }

  const moras = lines.map((l) => l.moras);
  const inRange = moras.filter((m) => m >= MORA_MIN && m <= MORA_MAX).length;
  const moraRangeScore = Math.round((inRange / lines.length) * 100);

  let balanceOk = 0;
  for (let i = 0; i < moras.length - 1; i++) {
    if (Math.abs(moras[i] - moras[i + 1]) <= MORA_DELTA_MAX) balanceOk++;
  }
  const moraBalanceScore =
    moras.length > 1
      ? Math.round((balanceOk / (moras.length - 1)) * 100)
      : 100;

  const endPairs: { tailLen: number; jaccard: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const tailLen = matchingVowelTailLen(
        lines[i].endVowels,
        lines[j].endVowels,
        5,
      );
      if (tailLen >= 3) {
        endPairs.push({
          tailLen,
          jaccard: suffixJaccard(lines[i].text, lines[j].text, 5),
        });
      }
    }
  }

  let rhymeLengthScore = 50;
  let lowDuplicationScore = 80;
  let avgSuffixSimilarity = 0;

  if (endPairs.length > 0) {
    const avgTail =
      endPairs.reduce((s, p) => s + p.tailLen, 0) / endPairs.length;
    rhymeLengthScore = Math.min(
      100,
      Math.round((avgTail / 5) * 100),
    );
    avgSuffixSimilarity =
      endPairs.reduce((s, p) => s + p.jaccard, 0) / endPairs.length;
    lowDuplicationScore = Math.round((1 - avgSuffixSimilarity) * 100);
  }

  const overallQuality = Math.round(
    rhymeLengthScore * 0.3 +
      lowDuplicationScore * 0.25 +
      moraRangeScore * 0.2 +
      moraBalanceScore * 0.15 +
      (100 - Math.round(avgSuffixSimilarity * 100)) * 0.1,
  );

  return {
    rhymeLengthScore,
    lowDuplicationScore,
    avgSuffixSimilarity: Math.round(avgSuffixSimilarity * 100) / 100,
    moraRangeScore,
    moraBalanceScore,
    overallQuality,
  };
}
