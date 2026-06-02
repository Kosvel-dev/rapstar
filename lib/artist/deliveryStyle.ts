import { extractRapLines } from "./cleanLyrics";

const ADLIB_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(Yo|Hey|Yeah|Ayy|Okay|Let's go)\b/gi, label: "英語フック・アドリブ" },
  { pattern: /\b(Ah,?\s*huh|Huh,?\s*huh)\b/gi, label: "Ah huh 系レスポンス" },
  { pattern: /\(.*?\)/g, label: "括弧内アドリブ" },
  { pattern: /(ー{2,}|〜+)/g, label: "伸ばし・余韻" },
  { pattern: /(Hah,?\s*){2,}/gi, label: "連続笑い声" },
  { pattern: /\b(G\.O\.A\.T|flow|rap|game)\b/gi, label: "ラップ用語混ぜ" },
];

const STOPWORDS = new Set([
  "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ", "さ",
  "ある", "いる", "する", "ない", "この", "その", "あの", "俺", "僕", "私",
  "the", "a", "an", "to", "in", "on", "it", "is", "be", "and", "or",
]);

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

export function analyzeDeliveryFromCorpus(allLyrics: string) {
  const lines = allLyrics.split("\n");
  const rapLines = lines.flatMap((block) => extractRapLines(block));
  const joined = rapLines.join("\n");

  const adlibPatterns = ADLIB_PATTERNS.map(({ pattern, label }) => ({
    pattern: label,
    count: countMatches(joined, pattern),
  })).filter((x) => x.count > 0);

  const englishTokens =
    joined.match(/[A-Za-z][A-Za-z'.-]*/g)?.length ?? 0;
  const japaneseTokens =
    joined.match(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]{2,}/gu)?.length ?? 0;
  const totalTokens = englishTokens + japaneseTokens || 1;
  const englishRatio = englishTokens / totalTokens;

  const englishMixLevel: "low" | "medium" | "high" =
    englishRatio > 0.18 ? "high" : englishRatio > 0.08 ? "medium" : "low";

  const exclamationCount = (joined.match(/[!！]/g) ?? []).length;
  const punchlineDensity =
    rapLines.length > 0
      ? Math.round((exclamationCount / rapLines.length) * 100) / 100
      : 0;

  const traits: string[] = [];
  if (englishMixLevel !== "low") traits.push("日英ミックス");
  if (adlibPatterns.some((p) => p.pattern.includes("Ah huh"))) {
    traits.push("コール＆レスポンス型フック");
  }
  if (adlibPatterns.some((p) => p.pattern.includes("英語フック"))) {
    traits.push("英語アドリブでテンションを上げる");
  }
  if (joined.includes("アンチ") || joined.includes("炎上")) {
    traits.push("アンチ・世間への言及が多い");
  }
  if (joined.includes("成り上が") || joined.includes("夢")) {
    traits.push("成り上がり・野心テーマ");
  }
  if (punchlineDensity > 0.15) traits.push("強い語尾・断定が多い");

  const styleSummary = [
    traits.length > 0 ? traits.join("、") : "ストレートな語り口",
    englishMixLevel === "high"
      ? "英語フレーズを随所に挟む"
      : englishMixLevel === "medium"
        ? "英語をアクセント程度に混ぜる"
        : "日本語主体",
    "フックで同じフレーズを反復しやすい",
  ].join("。");

  return {
    traits,
    adlibPatterns,
    englishMixLevel,
    punchlineDensity,
    styleSummary,
    englishTokenRatio: Math.round(englishRatio * 1000) / 1000,
  };
}

export function topWordsFromCorpus(allLyrics: string, limit = 30) {
  const words = allLyrics.match(/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]{2,}|[A-Za-z]{3,}/g) ?? [];
  const counts = new Map<string, number>();
  for (const w of words) {
    const key = w.toLowerCase() === w ? w : w;
    if (STOPWORDS.has(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}
