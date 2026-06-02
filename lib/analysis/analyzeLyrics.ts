import { countMoras, matchVowelTail, vowelKey } from "./kana";
import { extractRapLines } from "@/lib/artist/cleanLyrics";
import { isLikelyInvalidRhymeWord } from "@/lib/rhyme/rhymeWordValidity";
import {
  extractEndUnit,
  resolveLineReading,
  resolveWord,
  tokenizeLine,
} from "./reading";
import type {
  LineAnalysis,
  LineRhymeMetrics,
  LyricAnalysis,
  RhymeChain,
  RhymeDensityBreakdown,
  RhymeMatch,
  WordAnalysis,
} from "./types";
import {
  flowUniformityScore,
  stdDev,
  targetMorasPerLine,
} from "./bpm";
import { computeRhymeQuality } from "./rhymeQuality";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreInputWordUsage(lyrics: string, inputWords: string[]): number {
  if (inputWords.length === 0) return 100;
  const found = inputWords.filter((w) => lyrics.includes(w.trim())).length;
  return Math.round((found / inputWords.length) * 100);
}

function isValidAnalysisWord(word: string, allowedWords: string[]): boolean {
  return !isLikelyInvalidRhymeWord(word, { allowedWords });
}

function buildMatch(
  type: RhymeMatch["type"],
  a: WordAnalysis,
  b: WordAnalysis,
  lineIndexA: number,
  lineIndexB: number,
): RhymeMatch | null {
  const match = matchVowelTail(a.vowels, b.vowels, 3, 6);
  if (!match) return null;

  return {
    type,
    wordA: a.surface,
    wordB: b.surface,
    vowelsA: a.vowels,
    vowelsB: b.vowels,
    tail: match.tail,
    vowelKey: vowelKey(match.tail),
    lineIndexA,
    lineIndexB,
    strength: match.matchRate,
    syllables: match.syllables,
    matchRate: match.matchRate,
    multisyllable: match.syllables >= 3,
  };
}

function findRhymeMatches(
  lines: LineAnalysis[],
  allowedWords: string[],
): RhymeMatch[] {
  const matches: RhymeMatch[] = [];

  // 行末韻: 2音節一致は採用しない。最低3音節、最大6音節で評価する。
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
      const match = buildMatch(
        "end",
        {
          surface: a.endUnit,
          reading: a.endReading,
          vowels: a.endVowels,
          moras: 0,
        },
        {
          surface: b.endUnit,
          reading: b.endReading,
          vowels: b.endVowels,
          moras: 0,
        },
        i,
        j,
      );
      if (match) matches.push(match);
    }
  }

  // 内部韻: 同一小節内の異なる語句だけを比較する。
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const tokens = lines[lineIndex].tokens.filter((token) => token.vowels.length >= 3);
    for (let i = 0; i < tokens.length; i++) {
      for (let j = i + 1; j < tokens.length; j++) {
        if (
          tokens[i].surface === tokens[j].surface ||
          !isValidAnalysisWord(tokens[i].surface, allowedWords) ||
          !isValidAnalysisWord(tokens[j].surface, allowedWords)
        ) {
          continue;
        }
        const match = buildMatch("internal", tokens[i], tokens[j], lineIndex, lineIndex);
        if (match) matches.push(match);
      }
    }
  }

  return matches;
}

/** 4小節ごとに最も長く継続した行末母音列を抽出する。 */
function buildRhymeChains(lines: LineAnalysis[]): RhymeChain[] {
  const chains: RhymeChain[] = [];
  const sections: LineAnalysis[][] = [];

  for (const line of lines) {
    const current = sections.at(-1);
    if (!current || current[0]?.section !== line.section) {
      sections.push([line]);
    } else {
      current.push(line);
    }
  }

  for (const section of sections) {
    for (let start = 0; start < section.length; start += 4) {
      const chunk = section.slice(start, start + 4);
      if (chunk.length < 2) continue;

      const tails = new Map<string, number[]>();
      for (const line of chunk) {
        for (let length = 3; length <= Math.min(6, line.endVowels.length); length++) {
          const tail = line.endVowels.slice(-length);
          const indices = tails.get(tail) ?? [];
          indices.push(line.index);
          tails.set(tail, indices);
        }
      }

      const best = [...tails.entries()]
        .filter(([, indices]) => new Set(indices).size >= 2)
        .map(([tail, indices]) => [tail, [...new Set(indices)]] as const)
        .sort(
          ([tailA, indicesA], [tailB, indicesB]) =>
            indicesB.length - indicesA.length || tailB.length - tailA.length,
        )[0];

      if (!best) continue;
      const [tail, lineIndices] = best;
      chains.push({
        startLineIndex: chunk[0].index,
        endLineIndex: chunk.at(-1)!.index,
        tail,
        vowelKey: vowelKey(tail),
        lineIndices: [...lineIndices],
        coverage: clampScore((lineIndices.length / chunk.length) * 100),
      });
    }
  }

  return chains;
}

function multisyllableLineScore(matches: RhymeMatch[], lineIndex: number): number {
  const syllables = matches
    .filter((match) => match.lineIndexA === lineIndex || match.lineIndexB === lineIndex)
    .reduce((max, match) => Math.max(max, match.syllables), 0);
  if (syllables >= 5) return 100;
  if (syllables === 4) return 80;
  if (syllables === 3) return 60;
  return 0;
}

function lineMetrics(
  line: LineAnalysis,
  matches: RhymeMatch[],
  chains: RhymeChain[],
): LineRhymeMetrics {
  const related = matches.filter(
    (match) => match.lineIndexA === line.index || match.lineIndexB === line.index,
  );
  const internal = related.filter(
    (match) => match.type === "internal" && match.lineIndexA === line.index,
  );
  const endRhyme = related.some((match) => match.type === "end") ? 100 : 0;
  const internalRhyme = internal.length > 0 ? 100 : 0;
  const multisyllableRhyme = multisyllableLineScore(matches, line.index);
  const chain = chains.find((item) => item.lineIndices.includes(line.index));
  const consecutiveRhyme = chain?.coverage ?? 0;
  const vowelMatchRate = clampScore(
    related.reduce((max, match) => Math.max(max, match.matchRate), 0) * 100,
  );

  return {
    density: clampScore(
      endRhyme * 0.3 +
        internalRhyme * 0.25 +
        multisyllableRhyme * 0.25 +
        consecutiveRhyme * 0.2,
    ),
    internalRhymeCount: internal.length,
    vowelMatchRate,
    endRhyme,
    multisyllableRhyme,
    consecutiveRhyme,
  };
}

function buildDensity(
  matches: RhymeMatch[],
  lines: LineAnalysis[],
  chains: RhymeChain[],
  lyrics: string,
  inputWords: string[],
  flowScore: number,
): RhymeDensityBreakdown {
  if (lines.length === 0) {
    return {
      endRhyme: 0,
      internalRhyme: 0,
      multisyllableRhyme: 0,
      consecutiveRhyme: 0,
      overall: 0,
      inputWordUsage: scoreInputWordUsage(lyrics, inputWords),
      flowUniformity: flowScore,
    };
  }

  const endLines = new Set<number>();
  const internalLines = new Set<number>();
  for (const match of matches) {
    if (match.type === "end") {
      endLines.add(match.lineIndexA);
      endLines.add(match.lineIndexB);
    } else {
      internalLines.add(match.lineIndexA);
    }
  }

  const endRhyme = clampScore((endLines.size / lines.length) * 100);
  const internalRhyme = clampScore((internalLines.size / lines.length) * 100);
  const multisyllableRhyme = clampScore(
    lines.reduce((sum, line) => sum + multisyllableLineScore(matches, line.index), 0) /
      lines.length,
  );
  const chainedLines = new Set(chains.flatMap((chain) => chain.lineIndices));
  const consecutiveRhyme = clampScore((chainedLines.size / lines.length) * 100);

  // 指定式: end * 30 + internal * 25 + multisyllable * 25 + consecutive * 20
  const overall = clampScore(
    endRhyme * 0.3 +
      internalRhyme * 0.25 +
      multisyllableRhyme * 0.25 +
      consecutiveRhyme * 0.2,
  );

  return {
    endRhyme,
    internalRhyme,
    multisyllableRhyme,
    consecutiveRhyme,
    overall,
    inputWordUsage: scoreInputWordUsage(lyrics, inputWords),
    flowUniformity: flowScore,
  };
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
  const rawLines: { text: string; section?: string }[] = [];
  let section: string | undefined;
  for (const rawLine of lyrics.split("\n")) {
    const text = rawLine.trim();
    if (/^\[[^\]]+\]$/.test(text)) {
      section = text.slice(1, -1);
      continue;
    }
    if (extractRapLines(text).length > 0) rawLines.push({ text, section });
  }
  const lines: LineAnalysis[] = [];

  for (let index = 0; index < rawLines.length; index++) {
    const { text, section } = rawLines[index];
    const endUnit = extractEndUnit(text);
    const endWord = await resolveWord(endUnit);
    const tokenSurfaces = [...new Set([...tokenizeLine(text), endUnit])];
    const tokens = await Promise.all(tokenSurfaces.map(resolveWord));
    const reading = await resolveLineReading(text, tokens);

    lines.push({
      index,
      text,
      section,
      reading,
      endUnit,
      endReading: endWord.reading,
      endVowels: endWord.vowels,
      moras: countMoras(reading),
      tokens,
    });
  }

  const morasPerLine = lines.map((line) => line.moras);
  const rhymeMatches = findRhymeMatches(lines, allowedWords);
  const rhymeChains = buildRhymeChains(lines);
  const uniformityScore = flowUniformityScore(morasPerLine);
  const bpm = options.bpm;
  const beatsPerBar = options.beatsPerBar ?? 4;

  for (const line of lines) {
    line.rhymeMetrics = lineMetrics(line, rhymeMatches, rhymeChains);
  }

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

  return {
    lines,
    rhymeMatches,
    rhymeChains,
    flow,
    density: buildDensity(
      rhymeMatches,
      lines,
      rhymeChains,
      lyrics,
      options.inputWords ?? [],
      uniformityScore,
    ),
    rhymeQuality: computeRhymeQuality(lines),
  };
}
