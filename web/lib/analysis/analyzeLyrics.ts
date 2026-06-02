import { isLikelyInvalidRhymeWord } from "@/lib/rhyme/rhymeWordValidity";
import { tailMatchScore, vowelTail } from "./kana";
import {
  extractEndUnit,
  resolveLineReading,
  resolveWord,
  tokenizeLine,
} from "./reading";
import type {
  LineAnalysis,
  LyricAnalysis,
  RhymeDensityBreakdown,
  RhymeMatch,
} from "./types";
import {
  flowUniformityScore,
  stdDev,
  targetMorasPerLine,
} from "./bpm";
import { computeRhymeQuality } from "./rhymeQuality";

function scoreInputWordUsage(lyrics: string, inputWords: string[]): number {
  if (inputWords.length === 0) return 100;
  const found = inputWords.filter((w) => lyrics.includes(w.trim())).length;
  return Math.round((found / inputWords.length) * 100);
}

function computeEndRhymeScore(matches: RhymeMatch[], lineCount: number): number {
  if (lineCount < 2) return 50;
  const endMatches = matches.filter((m) => m.type === "end");
  const maxPairs = (lineCount * (lineCount - 1)) / 2;
  const weighted = endMatches.reduce((s, m) => s + m.strength, 0);
  return Math.min(100, Math.round((weighted / Math.max(1, maxPairs)) * 100));
}

function computeInternalRhymeScore(
  matches: RhymeMatch[],
  tokenCount: number,
): number {
  if (tokenCount < 2) return 0;
  const internal = matches.filter((m) => m.type === "internal");
  const maxPairs = (tokenCount * (tokenCount - 1)) / 2;
  const weighted = internal.reduce((s, m) => s + m.strength, 0);
  return Math.min(100, Math.round((weighted / Math.max(1, maxPairs)) * 80));
}

function buildDensity(
  matches: RhymeMatch[],
  lines: LineAnalysis[],
  lyrics: string,
  inputWords: string[],
  flowScore: number,
): RhymeDensityBreakdown {
  const tokenCount = lines.reduce((s, l) => s + l.tokens.length, 0);
  const endRhyme = computeEndRhymeScore(matches, lines.length);
  const internalRhyme = computeInternalRhymeScore(matches, tokenCount);
  const inputWordUsage = scoreInputWordUsage(lyrics, inputWords);
  const flowUniformity = flowScore;

  const overall = Math.round(
    endRhyme * 0.35 +
      internalRhyme * 0.3 +
      inputWordUsage * 0.2 +
      flowUniformity * 0.15,
  );

  return {
    endRhyme,
    internalRhyme,
    inputWordUsage,
    flowUniformity,
    overall,
  };
}

function isValidAnalysisWord(word: string, allowedWords: string[]): boolean {
  return !isLikelyInvalidRhymeWord(word, { allowedWords });
}

function findRhymeMatches(
  lines: LineAnalysis[],
  allowedWords: string[],
): RhymeMatch[] {
  const matches: RhymeMatch[] = [];

  // 行末韻
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      if (
        !isValidAnalysisWord(a.endUnit, allowedWords) ||
        !isValidAnalysisWord(b.endUnit, allowedWords)
      ) {
        continue;
      }
      const strength = tailMatchScore(a.endVowels, b.endVowels);
      if (strength >= 0.5) {
        matches.push({
          type: "end",
          wordA: a.endUnit,
          wordB: b.endUnit,
          vowelsA: a.endVowels,
          vowelsB: b.endVowels,
          tail: vowelTail(a.endVowels, 2),
          lineIndexA: i,
          lineIndexB: j,
          strength,
        });
      }
    }
  }

  // 内部韻（同一行 + 隣接行）
  for (let li = 0; li < lines.length; li++) {
    const tokens = lines[li].tokens;
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        if (
          !isValidAnalysisWord(tokens[i].surface, allowedWords) ||
          !isValidAnalysisWord(tokens[j].surface, allowedWords)
        ) {
          continue;
        }
        const strength = tailMatchScore(tokens[i].vowels, tokens[j].vowels);
        if (strength >= 0.5) {
          matches.push({
            type: "internal",
            wordA: tokens[i].surface,
            wordB: tokens[j].surface,
            vowelsA: tokens[i].vowels,
            vowelsB: tokens[j].vowels,
            tail: vowelTail(tokens[i].vowels, 2),
            lineIndexA: li,
            lineIndexB: li,
            strength,
          });
        }
      }
    }
  }

  return matches;
}

/** 歌詞全文を解析 */
export async function analyzeLyrics(
  lyrics: string,
  options: {
    inputWords?: string[];
    bpm?: number;
    beatsPerBar?: number;
  } = {},
): Promise<LyricAnalysis> {
  const allowedWords = [
    ...(options.inputWords ?? []),
    ...(options.inputWords ?? []).flatMap((input) => {
      const katakana = input.match(/([ァ-ヴー]{2,})$/u);
      const kanji = input.match(/([一-龥々]{2,5})$/u);
      return [katakana?.[1], kanji?.[1]].filter(Boolean) as string[];
    }),
  ];

  const rawLines = lyrics
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const lines: LineAnalysis[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const text = rawLines[i];
    const endUnit = extractEndUnit(text);
    const endWord = await resolveWord(endUnit);
    const tokenSurfaces = tokenizeLine(text);
    const tokens = await Promise.all(tokenSurfaces.map(resolveWord));
    const moras = tokens.reduce((s, t) => s + t.moras, 0) || endWord.moras;
    const reading = await resolveLineReading(text, tokens);

    lines.push({
      index: i,
      text,
      reading,
      endUnit,
      endReading: endWord.reading,
      endVowels: endWord.vowels,
      moras,
      tokens,
    });
  }

  const morasPerLine = lines.map((l) => l.moras);
  const rhymeMatches = findRhymeMatches(lines, allowedWords);
  const uniformityScore = flowUniformityScore(morasPerLine);
  const bpm = options.bpm;
  const beatsPerBar = options.beatsPerBar ?? 4;

  const flow = {
    morasPerLine,
    averageMoras:
      morasPerLine.length > 0
        ? Math.round(
            morasPerLine.reduce((a, b) => a + b, 0) / morasPerLine.length,
          )
        : 0,
    stdDevMoras: Math.round(stdDev(morasPerLine) * 10) / 10,
    uniformityScore,
    bpm,
    targetMorasPerLine: bpm ? targetMorasPerLine(bpm, beatsPerBar) : undefined,
    beatsPerBar,
  };

  const density = buildDensity(
    rhymeMatches,
    lines,
    lyrics,
    options.inputWords ?? [],
    uniformityScore,
  );

  const rhymeQuality = computeRhymeQuality(lines);

  return { lines, rhymeMatches, flow, density, rhymeQuality };
}
