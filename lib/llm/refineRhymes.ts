import { analyzeLyrics } from "@/lib/analysis/analyzeLyrics";
import { extractRapLines } from "@/lib/artist/cleanLyrics";
import type { ArtistProfile } from "@/lib/artist/types";
import { ANTI_REPETITION_RULES } from "@/lib/llm/antiRepetition";
import { NARRATIVE_COHESION_RULES } from "@/lib/llm/lyricCraftGuide";
import { deepseekChat } from "@/lib/llm/deepseekChat";
import type { RhymePlan } from "@/lib/llm/rhymePlan";
import { RHYME_ANTI_DUMP_RULES, RHYME_CRAFT_RULES } from "@/lib/llm/rhymeGuide";
import { sanitizeGeneratedLyrics } from "@/lib/llm/sanitizeLyrics";

const MAX_REFINE_PASSES = 2;

export type RhymeCoverageMetrics = {
  endRhymeCoverage: number;
  internalRhymeCoverage: number;
  multisyllableCoverage: number;
  chainCoverage: number;
  score: number;
};

export async function measureRhymeMetrics(
  lyrics: string,
): Promise<RhymeCoverageMetrics> {
  const lines = extractRapLines(lyrics);
  if (lines.length < 2) {
    return {
      endRhymeCoverage: 0,
      internalRhymeCoverage: 0,
      multisyllableCoverage: 0,
      chainCoverage: 0,
      score: 0,
    };
  }
  const { density } = await analyzeLyrics(lines.join("\n"));
  return {
    endRhymeCoverage: density.endRhyme,
    internalRhymeCoverage: density.internalRhyme,
    multisyllableCoverage: density.multisyllableRhyme,
    chainCoverage: density.consecutiveRhyme,
    score: density.overall,
  };
}

export async function measureRhymeCoverage(lyrics: string): Promise<number> {
  return (await measureRhymeMetrics(lyrics)).score;
}

export async function refineLyricsRhymes(options: {
  lyrics: string;
  rhymePlan: RhymePlan;
  profile: ArtistProfile;
  theme: string;
  metrics: RhymeCoverageMetrics;
}): Promise<string> {
  const { lyrics, rhymePlan, profile, theme, metrics } = options;

  const system = `あなたは日本語ラップの作詞編集者です。
歌詞の意味・文体・行数・セクションタグを維持し、韻の弱い行だけを書き換えてください。
行末に韻用の語を足す修正は禁止。文全体を自然に言い換える。

${RHYME_CRAFT_RULES}
${RHYME_ANTI_DUMP_RULES}
${ANTI_REPETITION_RULES}
${NARRATIVE_COHESION_RULES}`;

  const user = [
    `# 参考プロファイル: ${profile.name}`,
    `# テーマ: ${theme}`,
    `# 現在の総合韻密度: ${metrics.score}%（目標 ${rhymePlan.targetDensity}%以上）`,
    `- 行末韻: ${metrics.endRhymeCoverage}%`,
    `- 内部韻: ${metrics.internalRhymeCoverage}%`,
    `- マルチシラブル韻: ${metrics.multisyllableCoverage}%`,
    `- 4小節チェーン: ${metrics.chainCoverage}%`,
    "",
    rhymePlan.promptBlock,
    "",
    "## 修正前",
    lyrics,
    "",
    "出力: 修正後の歌詞本文のみ。Markdown太字禁止。",
    "各行に自然な内部韻を最低1組置き、4小節単位で3〜6音節の母音列を維持する。",
    "行別計画に推奨行末語がある場合、文全体を自然に言い換えて必ずその語で終える。",
    "出力前に4行ずつ自己検査し、同じ母音列で終わらない行を残さない。",
    "同じ単語の反復や、行末への不自然な候補語追加は禁止。",
  ].join("\n");

  return sanitizeGeneratedLyrics(
    await deepseekChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: 1800,
      thinking: false,
      temperature: 0.55,
    }),
  );
}

export async function maybeRefineRhymes(options: {
  lyrics: string;
  rhymePlan: RhymePlan;
  profile: ArtistProfile;
  theme: string;
  enabled: boolean;
}): Promise<{
  lyrics: string;
  coverage: number;
  refined: boolean;
  metrics: RhymeCoverageMetrics;
}> {
  let lyrics = sanitizeGeneratedLyrics(options.lyrics);
  let metrics = await measureRhymeMetrics(lyrics);
  let refined = false;
  const expectedLineCount = extractRapLines(lyrics).length;

  if (!options.enabled || metrics.score >= options.rhymePlan.targetDensity) {
    return { lyrics, coverage: metrics.score, refined: false, metrics };
  }

  for (let pass = 0; pass < MAX_REFINE_PASSES; pass++) {
    if (metrics.score >= options.rhymePlan.targetDensity) break;
    const candidate = await refineLyricsRhymes({
      lyrics,
      rhymePlan: options.rhymePlan,
      profile: options.profile,
      theme: options.theme,
      metrics,
    });
    const candidateLineCount = extractRapLines(candidate).length;
    if (candidateLineCount !== expectedLineCount) continue;

    const candidateMetrics = await measureRhymeMetrics(candidate);
    if (candidateMetrics.score <= metrics.score) continue;

    lyrics = candidate;
    metrics = candidateMetrics;
    refined = true;
  }

  return { lyrics, coverage: metrics.score, refined, metrics };
}
