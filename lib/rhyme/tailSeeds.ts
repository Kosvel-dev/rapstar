/** 韻尾（母音列末尾）→ くじらハンド検索用シード語 */
export const VOWEL_TAIL_SEEDS: Record<string, string> = {
  ou: "クロウ",
  uo: "フロー",
  oi: "ボイ",
  ai: "カイ",
  ei: "セイ",
  ee: "コーヒー",
  ii: "リリック",
  iu: "リリック",
  ic: "ギミック",
  ick: "ギミック",
  an: "アン",
  on: "ホン",
  en: "セン",
  in: "シン",
  un: "ブン",
  ar: "カー",
  or: "ドア",
  er: "バー",
  a: "ラ",
  i: "リ",
  u: "フ",
  e: "エ",
  o: "コ",
};

export function seedWordForVowelTail(tail: string, fallback = "フロウ"): string {
  if (!tail) return fallback;
  const t = tail.toLowerCase();
  if (VOWEL_TAIL_SEEDS[t]) return VOWEL_TAIL_SEEDS[t];
  if (t.length >= 2 && VOWEL_TAIL_SEEDS[t.slice(-2)]) {
    return VOWEL_TAIL_SEEDS[t.slice(-2)];
  }
  return fallback;
}
