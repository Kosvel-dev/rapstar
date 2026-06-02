import { matchVowelTail } from "@/lib/analysis/kana";
import { formatVowelTail } from "@/lib/ui/labels";
import { getRhymeCandidates } from "@/lib/rhyme/rhymeLookup";
import { filterRhymeCandidates } from "@/lib/rhyme/rhymeEndWord";
import { RHYME_ANTI_DUMP_RULES, RHYME_CRAFT_RULES } from "@/lib/llm/rhymeGuide";

export type RhymeScheme = "CHAIN4" | "AAAA";

export type RhymeLineTarget = {
  lineIndex: number;
  group: string;
  targetTail: string;
  suggestedEndWord?: string;
};

export type RhymePlan = {
  scheme: RhymeScheme;
  targetDensity: number;
  lines: RhymeLineTarget[];
  wordBankByGroup: Record<string, string[]>;
  promptBlock: string;
};

const DEFAULT_TAILS = ["aiou", "ouei", "eiai", "aiai", "ouia", "aoou"];

function themeSeedWord(theme: string): string {
  const cleaned = theme.replace(/[^\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fffA-Za-z]/g, " ");
  const parts = cleaned.split(/\s+/).filter((part) => part.length >= 2);
  if (parts.length === 0) return "フロー";
  return parts.at(-1) ?? parts[0] ?? "フロー";
}

function pickTails(profileTails: string[], count: number): string[] {
  const merged: string[] = [];
  // 生成の安定性を優先し、自然な候補語を管理している基礎辞書から使う。
  // プロファイル由来の頻出尾は、基礎辞書だけで足りない場合の補完に回す。
  for (const tail of [...DEFAULT_TAILS, ...profileTails]) {
    const normalized = tail.replace(/[^aiueo]/gi, "").toLowerCase().slice(-6);
    if (normalized.length < 3 || merged.includes(normalized)) continue;
    merged.push(normalized);
    if (merged.length >= count) break;
  }
  return merged;
}

function groupName(index: number): string {
  return String.fromCharCode("A".charCodeAt(0) + index);
}

async function fetchWordBank(
  seed: string,
  targetTail: string,
  limit = 12,
): Promise<string[]> {
  try {
    const candidates = filterRhymeCandidates(
      await getRhymeCandidates({ seed, targetTail, limit: limit * 2 }),
    );
    return candidates
      .filter((candidate) =>
        Boolean(matchVowelTail(candidate.vowels ?? "", targetTail, 3, 6)),
      )
      .sort(
        (a, b) =>
          Number(b.source === "local") - Number(a.source === "local") ||
          (b.score ?? 0) - (a.score ?? 0),
      )
      .slice(0, limit)
      .map((candidate) => candidate.word);
  } catch {
    return [];
  }
}

export async function buildRhymePlan(options: {
  bars: number;
  theme: string;
  artistVowelTails: string[];
  scheme?: RhymeScheme;
  targetDensity?: number;
  sectionTag?: string;
}): Promise<RhymePlan> {
  const scheme = options.scheme ?? "CHAIN4";
  const chainCount = scheme === "AAAA" ? 1 : Math.max(1, Math.ceil(options.bars / 4));
  const tails = pickTails(options.artistVowelTails, chainCount);
  const seed = themeSeedWord(options.theme);
  const targetDensity = options.targetDensity ?? 70;
  const groups = tails.map((tail, index) => ({
    name: groupName(index),
    tail,
  }));
  const wordBanks = await Promise.all(
    groups.map(async (group) => [
      group.name,
      await fetchWordBank(seed, group.tail),
    ] as const),
  );
  const wordBankByGroup = Object.fromEntries(wordBanks);
  const lines: RhymeLineTarget[] = [];

  for (let index = 0; index < options.bars; index++) {
    const groupIndex = scheme === "AAAA" ? 0 : Math.floor(index / 4) % groups.length;
    const group = groups[groupIndex];
    const bank = wordBankByGroup[group.name] ?? [];
    const suggestedEndWord = bank[index % 4 % Math.max(1, bank.length)];
    lines.push({
      lineIndex: index,
      group: group.name,
      targetTail: group.tail,
      suggestedEndWord,
    });
  }

  const chainSummary = groups
    .map(
      (group, index) =>
        `  ${index * 4 + 1}〜${Math.min(options.bars, index * 4 + 4)}行目 [${group.name}]: 母音列 ${formatVowelTail(group.tail)}`,
    )
    .join("\n");
  const linePlan = lines
    .map(
      (line) =>
        `  行${line.lineIndex + 1} [${line.group}]: ${formatVowelTail(line.targetTail)} を核に3〜6音節で踏む${
          line.suggestedEndWord
            ? `。文を自然に組み立て、行末は「${line.suggestedEndWord}」で終える`
            : ""
        }`,
    )
    .join("\n");
  const bankLines = Object.entries(wordBankByGroup)
    .filter(([, words]) => words.length > 0)
    .map(
      ([group, words]) =>
        `  グループ${group}の発想用候補（そのまま貼らない）: ${words.slice(0, 10).join("、")}`,
    )
    .join("\n");

  const promptBlock = [
    RHYME_CRAFT_RULES,
    RHYME_ANTI_DUMP_RULES,
    "",
    `## ${options.sectionTag ?? "Verse"} の韻密度目標: ${targetDensity}%以上`,
    "## 4小節ライムチェーン",
    chainSummary,
    "",
    "## 行別の母音列",
    linePlan,
    bankLines ? `\n${bankLines}` : "",
    "",
    "各行に内部韻を最低1組入れる。行末だけでなく行の途中にも同系統の母音列を自然に配置する。",
    "推奨行末語がある行は、その語が文の意味に自然につながるよう文全体を組み立て、必ず指定語で終える。行末へ後付けで貼らない。",
    "出力直前に4行ずつ読み直し、4行すべての行末が同じ母音列になっているか自己検査する。",
  ]
    .filter(Boolean)
    .join("\n");

  return { scheme, targetDensity, lines, wordBankByGroup, promptBlock };
}
