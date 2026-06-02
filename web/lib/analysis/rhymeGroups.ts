import { tailMatchScore, vowelTail } from "./kana";
import type { LineAnalysis } from "./types";

export type RhymeGroup = {
  id: string;
  tail: string;
  lineIndices: number[];
  endUnits: string[];
  strength: number;
};

export type RhymeSummary = {
  totalLines: number;
  linesWithEndRhyme: number;
  endRhymeCoverage: number;
  groupCount: number;
  verdict: string;
};

export function buildRhymeGroups(lines: LineAnalysis[]): RhymeGroup[] {
  const groups = new Map<string, RhymeGroup>();

  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i];
      const b = lines[j];
      if (!a.endVowels || !b.endVowels) continue;

      const strength = tailMatchScore(a.endVowels, b.endVowels, 2);
      if (strength < 0.5) continue;

      const tail = vowelTail(a.endVowels, 2);
      const key = tail || `${a.endUnit}-${b.endUnit}`;
      const existing = groups.get(key);

      if (existing) {
        if (!existing.lineIndices.includes(i)) existing.lineIndices.push(i);
        if (!existing.lineIndices.includes(j)) existing.lineIndices.push(j);
        if (!existing.endUnits.includes(a.endUnit)) existing.endUnits.push(a.endUnit);
        if (!existing.endUnits.includes(b.endUnit)) existing.endUnits.push(b.endUnit);
        existing.strength = Math.max(existing.strength, strength);
      } else {
        groups.set(key, {
          id: key,
          tail: key,
          lineIndices: [i, j],
          endUnits: [a.endUnit, b.endUnit],
          strength,
        });
      }
    }
  }

  return [...groups.values()]
    .map((g) => ({
      ...g,
      lineIndices: [...g.lineIndices].sort((a, b) => a - b),
    }))
    .sort((a, b) => b.lineIndices.length - a.lineIndices.length);
}

export function summarizeRhymeCoverage(
  lines: LineAnalysis[],
  groups: RhymeGroup[],
): RhymeSummary {
  const totalLines = lines.length;
  const rhymedIndices = new Set(groups.flatMap((g) => g.lineIndices));
  const linesWithEndRhyme = rhymedIndices.size;
  const coverage =
    totalLines > 0 ? Math.round((linesWithEndRhyme / totalLines) * 100) : 0;

  let verdict = "韻が弱いです — 行末の母音を揃えるとフローが締まります";
  if (coverage >= 70) verdict = "韻がしっかり踏めています";
  else if (coverage >= 45)
    verdict = "部分的に韻が取れています — もう一段強められます";
  else if (coverage >= 25)
    verdict = "韻は散発的です — 2行ごとに同じ韻尾を意識してみてください";

  return {
    totalLines,
    linesWithEndRhyme,
    endRhymeCoverage: coverage,
    groupCount: groups.length,
    verdict,
  };
}
