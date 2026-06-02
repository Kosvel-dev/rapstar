import { NextResponse } from "next/server";
import { vowelTail } from "@/lib/analysis/kana";
import { lookupReading } from "@/lib/reading/lookupReading";
import { getRhymesFromNwnwn } from "@/lib/rhyme/nwnwnProvider";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  if (!query) {
    return NextResponse.json({ error: "q is required" }, { status: 400 });
  }

  const lookup = await lookupReading(query);
  const queryTail = vowelTail(lookup.vowels, 2);

  let rhymes: {
    word: string;
    reading?: string;
    vowels?: string;
    tail: string;
    strength: number;
    source: string;
  }[] = [];

  try {
    const nwnwn = await getRhymesFromNwnwn(query);
    rhymes = nwnwn.slice(0, 20).map((c, i) => ({
      word: c.word,
      reading: c.reading,
      vowels: c.vowels,
      tail: c.vowels ? vowelTail(c.vowels, 2) : "",
      strength: c.score ?? Math.max(0.5, 1 - i * 0.03),
      source: "nwnwn",
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "nwnwn failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    query,
    queryReading: lookup.reading,
    queryVowels: lookup.vowels,
    queryTail,
    rhymes,
  });
}
