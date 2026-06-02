import { isMostlyKana, toHiragana, vowelsFromReading } from "@/lib/analysis/kana";
import { getKuromojiTokenizer } from "@/lib/kuromoji/getTokenizer";
import { isKuromojiEnabled } from "@/lib/kuromoji/isEnabled";

export type ReadingLookupResult = {
  reading: string;
  vowels: string;
  source: "kana" | "kuromoji" | "fallback";
};

const cache = new Map<string, ReadingLookupResult>();

async function lookupFromKuromoji(text: string): Promise<string | null> {
  if (!isKuromojiEnabled()) return null;

  try {
    const tokenizer = await getKuromojiTokenizer();
    const tokens = tokenizer.tokenize(text.trim());
    if (tokens.length === 0) return null;

    const reading = tokens
      .map((token) => toHiragana(token.reading ?? token.surface_form))
      .join("");
    return reading || null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[kuromoji] lookup failed:", message);
    return null;
  }
}

export async function lookupReading(text: string): Promise<ReadingLookupResult> {
  const key = text.trim();
  if (!key) {
    return { reading: "", vowels: "", source: "fallback" };
  }

  const cached = cache.get(key);
  if (cached) return cached;

  if (isMostlyKana(key)) {
    const reading = toHiragana(key);
    const result: ReadingLookupResult = {
      reading,
      vowels: vowelsFromReading(reading),
      source: "kana",
    };
    cache.set(key, result);
    return result;
  }

  const kuromojiReading = await lookupFromKuromoji(key);
  if (kuromojiReading) {
    const result: ReadingLookupResult = {
      reading: kuromojiReading,
      vowels: vowelsFromReading(kuromojiReading),
      source: "kuromoji",
    };
    cache.set(key, result);
    return result;
  }

  const reading = toHiragana(key);
  const result: ReadingLookupResult = {
    reading,
    vowels: vowelsFromReading(reading),
    source: "fallback",
  };
  cache.set(key, result);
  return result;
}

export async function lookupLineReading(text: string): Promise<string | null> {
  const cleaned = text.trim();
  if (!cleaned) return null;
  if (isMostlyKana(cleaned)) return toHiragana(cleaned);
  return lookupFromKuromoji(cleaned);
}
