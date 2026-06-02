import { countMoras, isMostlyKana, toHiragana } from "./kana";
import { lookupLineReading, lookupReading } from "@/lib/reading/lookupReading";
import type { WordAnalysis } from "./types";

const wordCache = new Map<string, WordAnalysis>();

/** 歌詞中の読み仮名注釈を除去 */
export function stripReadingAnnotations(text: string): string {
  return text.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").trim();
}

/** 1語の読み・母音・モーラを解決（kuromoji → nwnwn、キャッシュ付き） */
export async function resolveWord(surface: string): Promise<WordAnalysis> {
  const key = surface.trim();
  if (!key) {
    return { surface: "", reading: "", vowels: "", moras: 0 };
  }

  const cached = wordCache.get(key);
  if (cached) return cached;

  const lookup = await lookupReading(key);
  const result: WordAnalysis = {
    surface: key,
    reading: lookup.reading,
    vowels: lookup.vowels,
    moras: countMoras(lookup.reading),
  };
  wordCache.set(key, result);
  return result;
}

/** 行をトークン分割（助詞境界で分割、機械的3文字切りはしない） */
export function tokenizeLine(line: string): string[] {
  const cleaned = stripReadingAnnotations(line);
  const parts = cleaned.split(/[\s、。，．！？…・\-—]+/).filter(Boolean);
  const tokens: string[] = [];

  for (const part of parts) {
    // 助詞・接続で分割（長い塊を意味のある塊に）
    const segments = part
      .split(/(?<=[のはがをにでとへ])(?=[一-龥ぁ-んァ-ヴー])|(?<=[ぁ-ん])(?=[ァ-ヴー一-龥])/)
      .map((s) => trimEndGlue(s.trim()))
      .filter((s) => s.length >= 2);

    if (segments.length > 0) {
      tokens.push(...segments);
    } else if (part.length >= 2 && part.length <= 8) {
      tokens.push(part);
    } else if (part.length > 8) {
      // 長文は末尾の韻語＋残りの後半だけ（ぐカジャ等の断片を防ぐ）
      const end = extractEndUnit(part);
      if (end.length >= 2) tokens.push(end);
      const rest = part.slice(0, -end.length).trim();
      if (rest.length >= 2 && rest.length <= 8) tokens.push(rest);
    }
  }

  return tokens;
}

/** 行末の1文字助詞を除いて韻語を取る（ぐカジャ → カジャ、く夜明け → 夜明け） */
function trimEndGlue(unit: string): string {
  const trimmed = unit
    .replace(/^[ぁ-ん]{1,2}(?=[一-龥ァ-ヴー])/, "")
    .replace(/^[ぁ-ん](?=[ァ-ヴー一-龥])/, "")
    .replace(/^[のはがをにでとへくて](?=[一-龥ぁ-んァ-ヴー])/, "");

  // 助詞除去後も断片なら空にして呼び出し側でフォールバック
  if (trimmed.length < 2) return unit;

  return trimmed;
}

/** 行全体の読み（表示用・ひらがな） */
export function lineReadingFromTokens(
  text: string,
  tokens: WordAnalysis[],
): string {
  const cleaned = stripReadingAnnotations(text);
  if (!cleaned) return "";

  if (isMostlyKana(cleaned) && !/[\u4e00-\u9fff]/.test(cleaned)) {
    return toHiragana(cleaned);
  }

  const fromTokens = tokens
    .map((t) => t.reading)
    .filter(Boolean)
    .join("");
  if (fromTokens) return fromTokens;

  return toHiragana(cleaned);
}

/** kuromoji で行全体の読みを解決（失敗時は token 合成へ） */
export async function resolveLineReading(
  text: string,
  fallbackTokens: WordAnalysis[],
): Promise<string> {
  const cleaned = stripReadingAnnotations(text);
  if (!cleaned) return "";

  const lineReading = await lookupLineReading(cleaned);
  if (lineReading) return lineReading;

  return lineReadingFromTokens(text, fallbackTokens);
}

/** 行末の韻単位（マルチシラブル韻を拾うため末尾2〜6文字の語句） */
export function extractEndUnit(line: string): string {
  const cleaned = stripReadingAnnotations(line);
  const match = cleaned.match(
    /[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff\u3400-\u4dbfa-zA-Z0-9]+$/,
  );
  if (!match) return cleaned.slice(-3);

  const word = match[0];

  // 活用語尾だけでなく「対象を超えて」のような末尾フレーズを残す。
  const tailPhrase = word.length <= 6 ? word : word.slice(-6);
  return trimEndGlue(tailPhrase);
}
