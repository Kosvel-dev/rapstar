import { countMoras, toHiragana } from "@/lib/analysis/kana";
import { isLikelyInvalidRhymeWord } from "@/lib/rhyme/rhymeWordValidity";
import type { RhymeCandidate } from "@/lib/rhyme/types";

/** 辞書当て字・韻専用語（ラップ行末に不自然） */
const RHYME_DUMP_BLOCKLIST = new Set([
  "艾",
  "亜依",
  "麻系",
  "愛衣",
  "歩衣",
  "相",
  "アア",
  "ああ",
  "アイ",
  "エイ",
  "オウ",
  "I",
  "i",
  "AI",
  "ai",
  "A",
]);

/**
 * 行末語として使えるか（辞書語の韻当て・1文字足しを除外）
 */
export function isUsableRhymeEndWord(word: string, reading?: string): boolean {
  const w = word.trim();
  if (!w || w.length < 2) return false;
  if (RHYME_DUMP_BLOCKLIST.has(w)) return false;
  if (isLikelyInvalidRhymeWord(w)) return false;
  if (/^[一-龥々]$/.test(w)) return false;
  if (/^[A-Za-z]{1,2}$/.test(w)) return false;
  if (/^[\u30a1-\u30fa\u30fc]{1,2}$/u.test(w)) return false;
  if (/^[あ-んー]{1,2}$/u.test(w)) return false;
  if (/^[「」『』]/.test(w)) return false;

  const rd = toHiragana(reading ?? w);
  if (countMoras(rd) < 3) return false;

  // ひらがな1文字繰り返し（ああ 等）
  if (/^([あ-ん])\1$/u.test(rd)) return false;

  return true;
}

export function filterRhymeCandidates(
  candidates: RhymeCandidate[],
): RhymeCandidate[] {
  return candidates
    .filter((c) => isUsableRhymeEndWord(c.word, c.reading))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}
