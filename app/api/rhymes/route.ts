import { NextResponse } from "next/server";
import { matchVowelTail, vowelKey, vowelTail } from "@/lib/analysis/kana";
import { lookupReading } from "@/lib/reading/lookupReading";
import { filterRhymeCandidates } from "@/lib/rhyme/rhymeEndWord";
import { getRhymeCandidates } from "@/lib/rhyme/rhymeLookup";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const lookup = await lookupReading(query);
  const queryTail = vowelTail(lookup.vowels, Math.min(6, lookup.vowels.length));

  try {
    const candidates = filterRhymeCandidates(
      await getRhymeCandidates({
        seed: query,
        targetTail: queryTail,
        limit: 24,
      }),
    );

    const rhymes = candidates
      .map((candidate, index) => {
        const match = matchVowelTail(
          candidate.vowels ?? "",
          lookup.vowels,
          3,
          6,
        );
        return {
          word: candidate.word,
          reading: candidate.reading,
          vowels: candidate.vowels,
          tail: match?.tail ?? "",
          vowelKey: match ? vowelKey(match.tail) : "",
          syllables: match?.syllables ?? 0,
          matchRate: Math.round((match?.matchRate ?? 0) * 100),
          strength: candidate.score ?? Math.max(0.5, 1 - index * 0.03),
          source: candidate.source,
        };
      })
      .filter(
        (candidate) =>
          candidate.syllables >= 3 && candidate.word.trim() !== query,
      )
      .slice(0, 20);

    return NextResponse.json({
      query,
      queryReading: lookup.reading,
      queryVowels: lookup.vowels,
      queryVowelKey: vowelKey(lookup.vowels),
      queryTail,
      rhymes,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "rhyme lookup failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
