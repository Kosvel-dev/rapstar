import { matchVowelTail, vowelKey } from "@/lib/analysis/kana";
import { lookupReading } from "@/lib/reading/lookupReading";
import type { RhymeCandidate } from "@/lib/rhyme/types";

/** 生成時に必ず使える、母音列をキーにした小規模な基礎辞書。 */
export const BASE_VOWEL_RHYME_DICTIONARY: Record<string, string[]> = {
  AIOU: ["愛情", "対象", "解消", "代償", "内緒"],
  OUEI: ["証明", "共鳴", "透明", "運命"],
  AIAI: ["曖昧", "大体", "最大", "再会", "足りない"],
  OEOE: ["声越え", "俺の手", "夜を越え", "それぞれ"],
  OUIA: ["誇りだ", "残り火", "踊り場", "この身だ"],
  EIAI: ["正解", "限界", "警戒", "展開", "絶対"],
  OUI: ["勝利", "道理", "脳裏", "ストーリー"],
  AOU: ["覚悟", "過去", "雑踏", "葛藤"],
};

const dictionaryCache = new Map<string, RhymeCandidate[]>();

function normalizedVowels(vowels: string): string {
  return vowels.replace(/[^aiueo]/gi, "").toLowerCase();
}

/** 任意の単語群を { AIOU: [...] } 形式に変換する。 */
export async function buildVowelDictionary(
  words: string[],
): Promise<Record<string, string[]>> {
  const dictionary: Record<string, string[]> = {};
  for (const word of [...new Set(words.map((w) => w.trim()).filter(Boolean))]) {
    const lookup = await lookupReading(word);
    const key = vowelKey(lookup.vowels);
    if (key.length < 3) continue;
    (dictionary[key] ??= []).push(word);
  }
  return dictionary;
}

/** 指定母音列に3〜6音節で一致するローカル辞書候補を返す。 */
export async function getLocalRhymesByVowels(
  targetVowels: string,
  limit = 24,
): Promise<RhymeCandidate[]> {
  const target = normalizedVowels(targetVowels);
  if (target.length < 3) return [];

  const cacheKey = `${target}:${limit}`;
  const cached = dictionaryCache.get(cacheKey);
  if (cached) return cached;

  const candidates: RhymeCandidate[] = [];
  for (const [key, words] of Object.entries(BASE_VOWEL_RHYME_DICTIONARY)) {
    const match = matchVowelTail(target, key.toLowerCase(), 3, 6);
    if (!match) continue;

    for (const word of words) {
      const lookup = await lookupReading(word);
      const actualMatch = matchVowelTail(target, lookup.vowels, 3, 6);
      if (!actualMatch) continue;
      candidates.push({
        word,
        reading: lookup.reading,
        vowels: lookup.vowels,
        score: actualMatch.matchRate,
        source: "local",
      });
    }
  }

  const sorted = candidates
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
  dictionaryCache.set(cacheKey, sorted);
  return sorted;
}
