import { lookupReading } from "@/lib/reading/lookupReading";
import { matchVowelTail } from "@/lib/analysis/kana";
import {
  filterByVowelTail,
  getRhymesFromKujirahand,
} from "@/lib/rhyme/kujirahandProvider";
import { getRhymesFromNwnwn } from "@/lib/rhyme/nwnwnProvider";
import { filterRhymeCandidates } from "@/lib/rhyme/rhymeEndWord";
import { seedWordForVowelTail } from "@/lib/rhyme/tailSeeds";
import type { RhymeCandidate } from "@/lib/rhyme/types";
import { getLocalRhymesByVowels } from "@/lib/rhyme/vowelDictionary";

function dedupeCandidates(items: RhymeCandidate[]): RhymeCandidate[] {
  const seen = new Set<string>();
  const out: RhymeCandidate[] = [];
  for (const item of items) {
    const key = item.word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/** 意味検索（外部）+ 母音検索（ローカル辞書）から韻候補を取得 */
export async function getRhymeCandidates(options: {
  seed: string;
  targetTail: string;
  limit?: number;
}): Promise<RhymeCandidate[]> {
  const limit = options.limit ?? 16;
  const tail = options.targetTail.slice(-6) || options.targetTail;
  const kujiraKey = seedWordForVowelTail(tail, options.seed);

  const [local, kujiraComp, kujiraTail, nwnwn] = await Promise.all([
    getLocalRhymesByVowels(tail, 24),
    getRhymesFromKujirahand(kujiraKey, { mode: "comp", limit: 24 }).catch(
      () => [] as RhymeCandidate[],
    ),
    getRhymesFromKujirahand(options.seed, { mode: "usiro", limit: 24 }).catch(
      () => [] as RhymeCandidate[],
    ),
    getRhymesFromNwnwn(options.seed).catch(() => [] as RhymeCandidate[]),
  ]);

  const merged = filterRhymeCandidates(
    dedupeCandidates([
      ...local,
      ...filterByVowelTail(kujiraComp, tail),
      ...filterByVowelTail(kujiraTail, tail),
      ...filterByVowelTail(nwnwn, tail),
      ...kujiraComp,
      ...kujiraTail,
      ...nwnwn,
    ]),
  ).sort((a, b) => {
    const aMatch = matchVowelTail(a.vowels ?? "", tail, 3, 6);
    const bMatch = matchVowelTail(b.vowels ?? "", tail, 3, 6);
    return (
      (bMatch?.syllables ?? 0) - (aMatch?.syllables ?? 0) ||
      (b.score ?? 0) - (a.score ?? 0)
    );
  });

  if (merged.length >= 4) {
    return merged.slice(0, limit);
  }

  const seedLookup = await lookupReading(options.seed);
  return dedupeCandidates([
    {
      word: options.seed,
      reading: seedLookup.reading,
      vowels: seedLookup.vowels,
      score: 1,
      source: "kujirahand",
    },
    ...merged,
  ]).slice(0, limit);
}
