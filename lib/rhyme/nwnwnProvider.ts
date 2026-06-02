import type { RhymeCandidate } from "./types";
import { fetchWithTimeout } from "./fetchUtils";

type NwnwnItem = { surface: string; yomi: string; vowels: string };
type NwnwnResponse = {
  yomi?: string;
  vowels?: string;
  results?: Record<string, NwnwnItem[]>;
};

const DEFAULT_BASE = "https://in.nwnwn.com";

export async function getRhymesFromNwnwn(word: string): Promise<RhymeCandidate[]> {
  const baseUrl = process.env.RHYME_NWNWN_BASE_URL ?? DEFAULT_BASE;
  const url = `${baseUrl.replace(/\/$/, "")}/api/rhyme`;

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ text: word }),
  });

  if (!response.ok) {
    throw new Error(`nwnwn HTTP ${response.status}`);
  }

  const data = (await response.json()) as NwnwnResponse;
  const items = Object.values(data.results ?? {}).flat();
  if (items.length === 0) return [];

  return items.map((item, index) => ({
    word: item.surface,
    reading: item.yomi,
    vowels: item.vowels,
    score: Math.max(0.5, 1 - index * 0.02),
    source: "nwnwn" as const,
    ...(index === 0 ? { inputReading: data.yomi, inputVowels: data.vowels } : {}),
  }));
}
