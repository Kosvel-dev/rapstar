import { bpmFlowInstruction } from "@/lib/analysis/bpm";
import type { ArtistProfile } from "@/lib/artist/types";
import { ANTI_REPETITION_RULES } from "@/lib/llm/antiRepetition";
import { deepseekChat } from "@/lib/llm/deepseekChat";
import {
  lyricCraftSystemBlock,
  punchlineInstruction,
} from "@/lib/llm/lyricCraftGuide";
import {
  buildMiniNarrativePlan,
  narrativePlanPromptBlock,
} from "@/lib/llm/narrativePlan";
import { maybeReduceRepetition } from "@/lib/llm/reduceRepetition";
import {
  measureRhymeMetrics,
  maybeRefineRhymes,
  type RhymeCoverageMetrics,
} from "@/lib/llm/refineRhymes";
import { END_RHYME_RULES, RHYME_ANTI_DUMP_RULES } from "@/lib/llm/rhymeGuide";
import { sanitizeGeneratedLyrics } from "@/lib/llm/sanitizeLyrics";
import { buildRhymePlan, type RhymeScheme } from "@/lib/llm/rhymePlan";
import { formatVowelTail } from "@/lib/ui/labels";
import { combineTheme, type LyricThemeInput } from "@/lib/llm/themeInput";
import {
  getLearningMode,
  learningModePromptBlock,
  type LearningModeId,
} from "@/lib/llm/learningModes";

export type GenerateInStyleRequest = LyricThemeInput & {
  artistProfile: ArtistProfile;
  bpm?: number;
  bars?: 4 | 8 | 16;
  referenceLine?: string;
  /** 韻を強めに生成 + 不足時は自動修正 */
  strongRhyme?: boolean;
  learningMode?: LearningModeId;
};

export type GenerateInStyleResult = {
  lyrics: string;
  rhymeCoverage: number;
  rhymeRefined: boolean;
  repetitionReduced: boolean;
  rhymeMetrics: RhymeCoverageMetrics;
};

export async function generateLyricsInStyle(
  req: GenerateInStyleRequest,
): Promise<GenerateInStyleResult> {
  const bars = req.bars ?? 8;
  const bpm = req.bpm ?? 110;
  const profile = req.artistProfile;
  const strongRhyme = req.strongRhyme !== false;
  const theme = combineTheme(req);
  const learningMode = getLearningMode(req.learningMode);

  const topWords = profile.vocabulary.topWords
    .slice(0, 10)
    .map((w) => w.word)
    .join("、");

  const artistTails = profile.rhyme.commonEndVowelTails.map((v) => v.tail);
  const scheme: RhymeScheme = "CHAIN4";
  const rhymePlan = strongRhyme
    ? await buildRhymePlan({
        bars,
        theme,
        artistVowelTails: artistTails,
        scheme,
        sectionTag: "Verse",
        targetDensity: Math.max(70, learningMode.rhymeDensity),
      })
    : null;

  const vowelHint =
    artistTails.length > 0
      ? artistTails.slice(0, 4).map((t) => formatVowelTail(t)).join(" / ")
      : "オウ（ou） / アイ（ai）";

  const narrativePlan = await buildMiniNarrativePlan({
    profile,
    mainTheme: req.mainTheme,
    subTheme: req.subTheme,
    bars,
    referenceLine: req.referenceLine,
  });

  const craftBlock = lyricCraftSystemBlock();
  const storyBlock = narrativePlanPromptBlock(narrativePlan, "Verse");

  const system = strongRhyme
    ? `あなたは日本語ラップの作詞家です。韻（ライム）と「1本道の話」を両立させて歌詞を書きます。
参考プロファイルの統計的特徴を使い、既存作品を模倣せず新しい歌詞を書いてください。
内部韻と4小節ライムチェーンを含め、3〜6音節の母音韻を最大化してください。
既存フレーズの丸写しは禁止。

${craftBlock}

${END_RHYME_RULES}

${ANTI_REPETITION_RULES}

${RHYME_ANTI_DUMP_RULES}

${punchlineInstruction()}

【書き方】
1. 各行を意味の通じる文として書く
2. 各行に内部韻を最低1組入れる
3. 4小節単位で同じ3〜6音節の母音列を維持する
4. 候補語は参考。行末に語を足したり **太字** にしない`
    : `あなたは日本語ラップの作詞家です。
参考プロファイルの統計的特徴を使い、既存作品を模倣せず1本道の話で歌詞を書きます。
最低3音節の母音韻と自然な内部韻を使う。

${craftBlock}

${ANTI_REPETITION_RULES}`;

  const userParts = [
    `# 参考プロファイル: ${profile.name}`,
    learningModePromptBlock(learningMode),
    `## 文体サマリー\n${profile.delivery.styleSummary}`,
    `## 特徴\n${profile.delivery.traits.join("、") || "なし"}`,
    `## 語彙傾向（参考 — 毎行使い回さない）\n${topWords}`,
    strongRhyme && rhymePlan
      ? rhymePlan.promptBlock
      : `## 韻\nよく使う韻尾: ${vowelHint} — 4小節ごとに3音節以上で揃える`,
    `## フロー\n平均 ${profile.flow.averageMorasPerLine} モーラ/行、均一性 ${profile.flow.uniformityScore}/100`,
    `## 英語混ぜ\n${profile.delivery.englishMixLevel}`,
    "",
    storyBlock,
    "",
    `# 今回の条件`,
    `大テーマ: ${req.mainTheme}`,
    `小テーマ: ${req.subTheme}`,
    bpmFlowInstruction(bpm),
    `行数: 正確に ${bars} 行（セクション見出し [Verse] 等は行数に含めない）`,
    req.referenceLine ? `参考雰囲気: ${req.referenceLine}` : "",
    bars >= 8
      ? "Hook相当: 中盤にパンチラインを1行入れる（指定行数内）"
      : "",
    "",
    strongRhyme
      ? "出力: 歌詞本文のみ。Markdown太字禁止。各行は完結した文。"
      : "出力: 歌詞本文のみ。[Verse] [Hook] 等OK。",
  ].filter(Boolean);

  const draft = sanitizeGeneratedLyrics(
    await deepseekChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: userParts.join("\n") },
      ],
      maxTokens: bars <= 4 ? 700 : bars <= 8 ? 1100 : 1600,
      thinking: false,
      temperature: strongRhyme ? 0.72 : 0.85,
    }),
  );

  if (!strongRhyme || !rhymePlan) {
    const deduped = await maybeReduceRepetition({
      lyrics: draft,
      profile,
      theme,
    });
    const metrics = await measureRhymeMetrics(deduped.lyrics);
    return {
      lyrics: deduped.lyrics,
      rhymeCoverage: metrics.score,
      rhymeRefined: false,
      repetitionReduced: deduped.repetitionReduced,
      rhymeMetrics: metrics,
    };
  }

  const { lyrics, refined } = await maybeRefineRhymes({
    lyrics: draft,
    rhymePlan,
    profile,
    theme,
    enabled: true,
  });

  const deduped = await maybeReduceRepetition({
    lyrics,
    profile,
    theme,
  });

  const finalRefine = await maybeRefineRhymes({
    lyrics: deduped.lyrics,
    rhymePlan,
    profile,
    theme,
    enabled: deduped.repetitionReduced,
  });

  return {
    lyrics: finalRefine.lyrics,
    rhymeCoverage: finalRefine.coverage,
    rhymeRefined: refined || finalRefine.refined,
    repetitionReduced: deduped.repetitionReduced,
    rhymeMetrics: finalRefine.metrics,
  };
}
