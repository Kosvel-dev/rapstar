import { formatVowelTail } from "@/lib/ui/labels";
import { getRhymesFromNwnwn } from "@/lib/rhyme/nwnwnProvider";
import { vowelTail } from "@/lib/analysis/kana";

export type RhymeScheme = "AABB" | "AAAA";

export type RhymeLineTarget = {
  lineIndex: number;
  group: "A" | "B" | "C" | "D";
  targetTail: string;
};

export type RhymePlan = {
  scheme: RhymeScheme;
  lines: RhymeLineTarget[];
  wordBankByGroup: Record<string, string[]>;
  promptBlock: string;
};

const DEFAULT_TAILS = ["ou", "ai", "ei", "an"];

function themeSeedWord(theme: string): string {
  const cleaned = theme.replace(/[^\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fffA-Za-z]/g, " ");
  const parts = cleaned.split(/\s+/).filter((p) => p.length >= 2);
  if (parts.length === 0) return "フロー";
  return parts[parts.length - 1] ?? parts[0] ?? "フロー";
}

function pickArtistTails(artistTails: string[], count: number): string[] {
  const fromProfile = artistTails.filter((t) => t.length >= 2).slice(0, count);
  const merged = [...fromProfile];
  for (const t of DEFAULT_TAILS) {
    if (merged.length >= count) break;
    if (!merged.includes(t)) merged.push(t);
  }
  return merged.slice(0, count);
}

function groupForLine(lineIndex: number, scheme: RhymeScheme): "A" | "B" {
  if (scheme === "AAAA") return "A";
  const pairIndex = Math.floor(lineIndex / 2);
  return pairIndex % 2 === 0 ? "A" : "B";
}

function tailForGroup(group: "A" | "B", tails: [string, string]): string {
  return group === "A" ? tails[0] : tails[1];
}

async function fetchWordBank(
  seed: string,
  targetTail: string,
  limit = 12,
): Promise<string[]> {
  try {
    const candidates = await getRhymesFromNwnwn(seed);
    const matched = candidates
      .filter((c) => {
        if (!c.vowels) return false;
        const tail = vowelTail(c.vowels, 2);
        return tail === targetTail || c.vowels.endsWith(targetTail);
      })
      .slice(0, limit)
      .map((c) => c.word);

    if (matched.length >= 4) return matched;
    return candidates.slice(0, limit).map((c) => c.word);
  } catch {
    return [];
  }
}

export async function buildRhymePlan(options: {
  bars: number;
  theme: string;
  artistVowelTails: string[];
  scheme?: RhymeScheme;
}): Promise<RhymePlan> {
  const scheme = options.scheme ?? "AABB";
  const [tailA, tailB] = pickArtistTails(options.artistVowelTails, 2) as [
    string,
    string,
  ];
  const seed = themeSeedWord(options.theme);

  const [bankA, bankB] = await Promise.all([
    fetchWordBank(seed, tailA),
    scheme === "AABB" ? fetchWordBank(seed, tailB) : Promise.resolve([]),
  ]);

  const wordBankByGroup: Record<string, string[]> = {
    A: bankA,
    ...(scheme === "AABB" ? { B: bankB } : {}),
  };

  const lines: RhymeLineTarget[] = [];
  for (let i = 0; i < options.bars; i++) {
    const group = groupForLine(i, scheme);
    lines.push({
      lineIndex: i,
      group,
      targetTail: tailForGroup(group, [tailA, tailB]),
    });
  }

  const schemeDesc =
    scheme === "AAAA"
      ? `全${options.bars}行とも韻尾 ${formatVowelTail(tailA)} で統一（AAAA）`
      : `A行=韻尾 ${formatVowelTail(tailA)}、B行=韻尾 ${formatVowelTail(tailB)} を交互（AABB）`;

  const linePlan = lines
    .map(
      (l) =>
        `  行${l.lineIndex + 1} [${l.group}]: 末尾母音 ${formatVowelTail(l.targetTail)}`,
    )
    .join("\n");

  const bankLines = Object.entries(wordBankByGroup)
    .map(([g, words]) => {
      if (words.length === 0) return "";
      return `  グループ${g}の行末候補: ${words.slice(0, 10).join("、")}`;
    })
    .filter(Boolean)
    .join("\n");

  const promptBlock = [
    "## 韻スキーム（この通りに書く — 最優先）",
    schemeDesc,
    linePlan,
    bankLines ? `\n${bankLines}` : "",
    "",
    "各行の最後1〜2語は上記韻尾の母音で終える。意味が通る範囲で候補語を積極的に使う。",
  ]
    .filter(Boolean)
    .join("\n");

  return { scheme, lines, wordBankByGroup, promptBlock };
}
