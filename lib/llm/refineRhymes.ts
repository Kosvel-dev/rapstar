import { analyzeLyrics } from "@/lib/analysis/analyzeLyrics";
import {
  buildRhymeGroups,
  summarizeRhymeCoverage,
} from "@/lib/analysis/rhymeGroups";
import { extractRapLines } from "@/lib/artist/cleanLyrics";
import type { ArtistProfile } from "@/lib/artist/types";
import { deepseekChat } from "@/lib/llm/deepseekChat";
import type { RhymePlan } from "@/lib/llm/rhymePlan";

const COVERAGE_THRESHOLD = 55;

export async function measureRhymeCoverage(lyrics: string): Promise<number> {
  const lines = extractRapLines(lyrics);
  if (lines.length < 2) return 0;
  const analysis = await analyzeLyrics(lines.join("\n"));
  const groups = buildRhymeGroups(analysis.lines);
  return summarizeRhymeCoverage(analysis.lines, groups).endRhymeCoverage;
}

export async function refineLyricsRhymes(options: {
  lyrics: string;
  rhymePlan: RhymePlan;
  profile: ArtistProfile;
  theme: string;
  currentCoverage: number;
}): Promise<string> {
  const { lyrics, rhymePlan, profile, theme, currentCoverage } = options;

  const system = `あなたは日本語ラップの作詞編集者です。
歌詞の意味・文体・行数は維持し、行末の韻だけを強化してください。
既存フレーズの丸写しは禁止。`;

  const user = [
    `# アーティスト: ${profile.name}`,
    `# テーマ: ${theme}`,
    `# 現在の韻カバー: ${currentCoverage}%（低い — 行末を直す）`,
    "",
    rhymePlan.promptBlock,
    "",
    "## 修正前の歌詞",
    lyrics,
    "",
    "出力: 修正後の歌詞本文のみ。[Verse] 等のタグは維持。行数は変えない。",
    "各行末の母音を韻スキームに合わせること。中身の言い回しは大きく変えてよい。",
  ].join("\n");

  return deepseekChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens: 1200,
    thinking: false,
    temperature: 0.65,
  });
}

export async function maybeRefineRhymes(options: {
  lyrics: string;
  rhymePlan: RhymePlan;
  profile: ArtistProfile;
  theme: string;
  enabled: boolean;
}): Promise<{ lyrics: string; coverage: number; refined: boolean }> {
  let coverage = await measureRhymeCoverage(options.lyrics);

  if (!options.enabled || coverage >= COVERAGE_THRESHOLD) {
    return { lyrics: options.lyrics, coverage, refined: false };
  }

  const refined = await refineLyricsRhymes({
    lyrics: options.lyrics,
    rhymePlan: options.rhymePlan,
    profile: options.profile,
    theme: options.theme,
    currentCoverage: coverage,
  });

  coverage = await measureRhymeCoverage(refined);
  return { lyrics: refined, coverage, refined: true };
}
