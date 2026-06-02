import { toHiragana } from "@/lib/analysis/kana";
import {
  resolveLineReading,
  tokenizeLine,
  resolveWord,
} from "@/lib/analysis/reading";
import { shouldShowReadingForLine } from "@/lib/reading/showReading";

const SECTION_HEADER = /^\[[^\]]+\]$/;
const PAREN_ONLY = /^\([^)]*\)$/;

export type AnnotatedLyricLine = {
  text: string;
  reading: string;
  isSectionHeader: boolean;
  /** 読みが本文と実質同じなら false */
  showReading: boolean;
};

export async function annotateLyricsWithReading(
  lyrics: string,
): Promise<AnnotatedLyricLine[]> {
  const rawLines = lyrics.split("\n");
  const results: AnnotatedLyricLine[] = [];

  for (const raw of rawLines) {
    const text = raw.trim();
    if (!text) continue;

    if (SECTION_HEADER.test(text)) {
      results.push({
        text,
        reading: "",
        isSectionHeader: true,
        showReading: false,
      });
      continue;
    }

    if (PAREN_ONLY.test(text)) {
      results.push({
        text,
        reading: toHiragana(text),
        isSectionHeader: false,
        showReading: false,
      });
      continue;
    }

    const tokenSurfaces = tokenizeLine(text);
    const tokens = await Promise.all(tokenSurfaces.map(resolveWord));
    const reading = await resolveLineReading(text, tokens);
    results.push({
      text,
      reading,
      isSectionHeader: false,
      showReading: shouldShowReadingForLine(text, reading),
    });
  }

  return results;
}

/** コピー用: 歌詞（よみがな）形式 */
export function formatLyricsWithReading(lines: AnnotatedLyricLine[]): string {
  return lines
    .map((l) => {
      if (l.isSectionHeader) return l.text;
      if (l.showReading) return `${l.text}（${l.reading}）`;
      return l.text;
    })
    .join("\n");
}
