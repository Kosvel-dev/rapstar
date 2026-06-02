import { matchVowelTail } from "@/lib/analysis/kana";
import { lookupReading } from "@/lib/reading/lookupReading";
import { fetchWithTimeout } from "@/lib/rhyme/fetchUtils";
import type { RhymeCandidate } from "@/lib/rhyme/types";

/** くじらハンド韻検索 https://kujirahand.com/web-tools/Words.php */
const BASE = "https://kujirahand.com/web-tools/Words.php";

export type KujiraRhymeMode = "comp" | "usiro";

type ParsedItem = {
  word: string;
  reading: string;
  popularity: number;
};

const htmlCache = new Map<string, ParsedItem[]>();

function parseResultList(html: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const re =
    /<li>[\s\S]*?<rb>([^<]*)<\/rb>[\s\S]*?<rt>([^<]+)<\/rt>[\s\S]*?(?:★(\d+)|okcount'>(\d+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const word = m[1].replace(/<[^>]+>/g, "").trim();
    const reading = m[2].trim();
    const popularity = Number(m[3] ?? m[4] ?? 0);
    if (!word || !reading) continue;
    items.push({ word, reading, popularity });
  }
  return items;
}

export async function getRhymesFromKujirahand(
  key: string,
  options: { mode?: KujiraRhymeMode; limit?: number } = {},
): Promise<RhymeCandidate[]> {
  const mode = options.mode ?? "comp";
  const limit = options.limit ?? 20;
  const cacheKey = `${mode}:${key}`;
  let parsed = htmlCache.get(cacheKey);

  if (!parsed) {
    const url = `${BASE}?key=${encodeURIComponent(key)}&m=boin-search&opt=${mode}&len=0`;
    const response = await fetchWithTimeout(
      url,
      { headers: { Accept: "text/html" } },
      10000,
    );
    if (!response.ok) {
      throw new Error(`kujirahand HTTP ${response.status}`);
    }
    parsed = parseResultList(await response.text());
    htmlCache.set(cacheKey, parsed);
  }

  const maxPop = parsed.reduce((m, i) => Math.max(m, i.popularity), 1);
  const candidates: RhymeCandidate[] = [];

  for (const [index, item] of parsed.entries()) {
    if (candidates.length >= limit) break;
    const lookup = await lookupReading(item.reading || item.word);
    candidates.push({
      word: item.word,
      reading: lookup.reading || item.reading,
      vowels: lookup.vowels,
      score: item.popularity
        ? 0.55 + (item.popularity / maxPop) * 0.45
        : Math.max(0.5, 1 - index * 0.03),
      source: "kujirahand",
    });
  }

  return candidates;
}

export function filterByVowelTail(
  candidates: RhymeCandidate[],
  targetTail: string,
  minTailLen = 3,
): RhymeCandidate[] {
  const tail = targetTail.slice(-6);
  return candidates.filter((c) => {
    if (!c.vowels) return false;
    return Boolean(matchVowelTail(c.vowels, tail, minTailLen, 6));
  });
}
