import { matchVowelTail, vowelKey } from "./kana";
import type { LineAnalysis, RhymeMatch } from "./types";

/** 4小節単位で、最低3音節の同一韻尾を維持できている割合 */
export function measureFourBarChainCoverage(lines: LineAnalysis[]): number {
  if (lines.length < 2) return 0;
  let covered = 0;

  for (let start = 0; start < lines.length; start += 4) {
    const chunk = lines.slice(start, start + 4);
    const counts = new Map<string, number>();
    for (const line of chunk) {
      const seen = new Set<string>();
      for (let length = 3; length <= Math.min(6, line.endVowels.length); length++) {
        seen.add(line.endVowels.slice(-length));
      }
      for (const tail of seen) counts.set(tail, (counts.get(tail) ?? 0) + 1);
    }
    covered += Math.max(0, ...counts.values());
  }

  return Math.round((covered / lines.length) * 100);
}

export type RhymeOccurrence = {
  lineIndex: number;
  word: string;
  type: RhymeMatch["type"];
};

export type RhymeGroup = {
  id: string;
  tail: string;
  vowelKey: string;
  lineIndices: number[];
  endUnits: string[];
  words: string[];
  occurrences: RhymeOccurrence[];
  strength: number;
  syllables: number;
};

export type RhymeSummary = {
  totalLines: number;
  linesWithEndRhyme: number;
  endRhymeCoverage: number;
  groupCount: number;
  verdict: string;
};

function addMatch(groups: Map<string, RhymeGroup>, match: RhymeMatch): void {
  const key = match.vowelKey || vowelKey(match.tail);
  const existing = groups.get(key) ?? {
    id: key,
    tail: match.tail,
    vowelKey: key,
    lineIndices: [],
    endUnits: [],
    words: [],
    occurrences: [],
    strength: 0,
    syllables: 0,
  };

  for (const lineIndex of [match.lineIndexA, match.lineIndexB]) {
    if (!existing.lineIndices.includes(lineIndex)) existing.lineIndices.push(lineIndex);
  }
  for (const word of [match.wordA, match.wordB]) {
    if (!existing.words.includes(word)) existing.words.push(word);
    if (match.type === "end" && !existing.endUnits.includes(word)) {
      existing.endUnits.push(word);
    }
  }
  for (const occurrence of [
    { lineIndex: match.lineIndexA, word: match.wordA, type: match.type },
    { lineIndex: match.lineIndexB, word: match.wordB, type: match.type },
  ]) {
    if (
      !existing.occurrences.some(
        (item) =>
          item.lineIndex === occurrence.lineIndex &&
          item.word === occurrence.word &&
          item.type === occurrence.type,
      )
    ) {
      existing.occurrences.push(occurrence);
    }
  }
  existing.strength = Math.max(existing.strength, match.strength);
  existing.syllables = Math.max(existing.syllables, match.syllables);
  groups.set(key, existing);
}

export function buildRhymeGroups(
  lines: LineAnalysis[],
  rhymeMatches: RhymeMatch[] = [],
): RhymeGroup[] {
  const groups = new Map<string, RhymeGroup>();
  for (const match of rhymeMatches) addMatch(groups, match);

  // 後方互換: matches を渡さない呼び出しでも行末グループは構築する。
  if (rhymeMatches.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const match = matchVowelTail(lines[i].endVowels, lines[j].endVowels, 3, 6);
        if (!match) continue;
        addMatch(groups, {
          type: "end",
          wordA: lines[i].endUnit,
          wordB: lines[j].endUnit,
          vowelsA: lines[i].endVowels,
          vowelsB: lines[j].endVowels,
          tail: match.tail,
          vowelKey: vowelKey(match.tail),
          lineIndexA: i,
          lineIndexB: j,
          strength: match.matchRate,
          syllables: match.syllables,
          matchRate: match.matchRate,
          multisyllable: true,
        });
      }
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      lineIndices: [...group.lineIndices].sort((a, b) => a - b),
      occurrences: [...group.occurrences].sort(
        (a, b) => a.lineIndex - b.lineIndex || b.word.length - a.word.length,
      ),
    }))
    .sort(
      (a, b) =>
        b.lineIndices.length - a.lineIndices.length || b.syllables - a.syllables,
    );
}

export function summarizeRhymeCoverage(
  lines: LineAnalysis[],
  groups: RhymeGroup[],
): RhymeSummary {
  const totalLines = lines.length;
  const endOccurrences = groups
    .flatMap((group) => group.occurrences)
    .filter((occurrence) => occurrence.type === "end")
    .map((occurrence) => occurrence.lineIndex);
  const linesWithEndRhyme = new Set(endOccurrences).size;
  const coverage =
    totalLines > 0 ? Math.round((linesWithEndRhyme / totalLines) * 100) : 0;

  let verdict = "韻が弱いです。3音節以上の母音列を4小節単位で揃えてください";
  if (coverage >= 70) verdict = "3音節以上の行末韻がしっかり踏めています";
  else if (coverage >= 45)
    verdict = "部分的に韻が取れています。内部韻と4小節チェーンを追加できます";
  else if (coverage >= 25)
    verdict = "韻は散発的です。まず4小節で同じ母音列を維持してください";

  return {
    totalLines,
    linesWithEndRhyme,
    endRhymeCoverage: coverage,
    groupCount: groups.length,
    verdict,
  };
}
