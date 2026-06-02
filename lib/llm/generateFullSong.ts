import { bpmFlowInstruction } from "@/lib/analysis/bpm";
import type { ArtistProfile } from "@/lib/artist/types";
import {
  ANTI_REPETITION_RULES,
  buildAvoidListPrompt,
  recentContextBlock,
} from "@/lib/llm/antiRepetition";
import { deepseekChat } from "@/lib/llm/deepseekChat";
import {
  lyricCraftSystemBlock,
  punchlineInstruction,
} from "@/lib/llm/lyricCraftGuide";
import {
  buildNarrativePlan,
  narrativePlanPromptBlock,
  type NarrativePlan,
} from "@/lib/llm/narrativePlan";
import { buildRhymePlan } from "@/lib/llm/rhymePlan";
import { END_RHYME_RULES, RHYME_ANTI_DUMP_RULES } from "@/lib/llm/rhymeGuide";
import { sanitizeGeneratedLyrics } from "@/lib/llm/sanitizeLyrics";
import { maybeReduceRepetition } from "@/lib/llm/reduceRepetition";
import {
  measureRhymeMetrics,
  maybeRefineRhymes,
  type RhymeCoverageMetrics,
} from "@/lib/llm/refineRhymes";
import {
  configsToSections,
  sectionRhymeDensityTarget,
  type SongSection,
  type SongSectionConfig,
  totalBars,
} from "@/lib/llm/songStructure";
import { formatVowelTail } from "@/lib/ui/labels";
import { combineTheme, type LyricThemeInput } from "@/lib/llm/themeInput";
import {
  getLearningMode,
  learningModePromptBlock,
  type LearningMode,
  type LearningModeId,
} from "@/lib/llm/learningModes";

export type GenerateFullSongRequest = LyricThemeInput & {
  artistProfile: ArtistProfile;
  bpm?: number;
  sections: SongSectionConfig[];
  referenceLine?: string;
  strongRhyme?: boolean;
  learningMode?: LearningModeId;
};

export type GenerateFullSongResult = {
  lyrics: string;
  rhymeCoverage: number;
  rhymeRefined: boolean;
  repetitionReduced: boolean;
  sectionCount: number;
  lineCount: number;
  rhymeMetrics: RhymeCoverageMetrics;
};

async function generateSection(options: {
  profile: ArtistProfile;
  bpm: number;
  section: SongSection;
  previousLyrics: string;
  referenceLine?: string;
  rhymeBlock?: string;
  narrativePlan: NarrativePlan;
  learningMode: LearningMode;
}): Promise<string> {
  const {
    profile,
    bpm,
    section,
    previousLyrics,
    referenceLine,
    rhymeBlock,
    narrativePlan,
    learningMode,
  } = options;

  const isHook =
    section.tag.toLowerCase().includes("hook") ||
    section.tag.toLowerCase().includes("chorus");

  const system = `あなたは日本語ラップの作詞家です。
曲の一部（${section.tag}）だけを書きます。指定行数（小節数）を厳守。
既存曲の丸写し禁止。
参考プロファイルの統計的特徴を使い、既存作品を模倣せず設計図どおり1本道の話を続ける。
各行に内部韻を入れ、4小節ごとに3〜6音節の母音列を維持する。各行は完結した文。

${END_RHYME_RULES}
${RHYME_ANTI_DUMP_RULES}

${lyricCraftSystemBlock()}

${ANTI_REPETITION_RULES}

${punchlineInstruction()}`;

  const user = [
    `# 参考プロファイル: ${profile.name}`,
    learningModePromptBlock(learningMode),
    `## 文体\n${profile.delivery.styleSummary}`,
    `## 語彙（参考 — 使い回さない）\n${profile.vocabulary.topWords.slice(0, 10).map((w) => w.word).join("、")}`,
    narrativePlanPromptBlock(narrativePlan, section.tag),
    rhymeBlock ?? "",
    previousLyrics ? buildAvoidListPrompt(previousLyrics) : "",
    previousLyrics ? recentContextBlock(previousLyrics) : "",
    "",
    `# 曲全体のテーマ`,
    `大テーマ: ${narrativePlan.mainTheme}`,
    `小テーマ: ${narrativePlan.subTheme}`,
    bpmFlowInstruction(bpm),
    referenceLine ? `# 参考雰囲気\n${referenceLine}` : "",
    "",
    `# 今書くパート: [${section.tag}]`,
    `小節数（行数）: 正確に ${section.lines} 行`,
    `このパートの方向性: ${section.note}`,
    isHook
      ? `Hook/Chorus: パンチライン「${narrativePlan.punchline}」を核に。フレーズ「${narrativePlan.hookPhrase}」は最大2回まで反復可`
      : "",
    "",
    `出力: [${section.tag}] タグ1行 + 歌詞 ${section.lines} 行のみ。Markdown太字禁止。`,
    "前パートの続きとして書く。別の話題・別の場所に飛ばない。",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await deepseekChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens:
      section.lines <= 4 ? 400 : section.lines <= 8 ? 700 : section.lines <= 16 ? 1200 : 1600,
    thinking: false,
    temperature: 0.8,
  });
  return sanitizeGeneratedLyrics(raw);
}

export async function generateFullSongLyrics(
  req: GenerateFullSongRequest,
): Promise<GenerateFullSongResult> {
  const bpm = req.bpm ?? 110;
  const profile = req.artistProfile;
  const strongRhyme = req.strongRhyme !== false;
  const theme = combineTheme(req);
  const learningMode = getLearningMode(req.learningMode);
  const songSections = configsToSections(req.sections);
  const lineCount = totalBars(req.sections);

  if (songSections.length === 0) {
    throw new Error("曲構成が空です");
  }

  const artistTails = profile.rhyme.commonEndVowelTails.map((v) => v.tail);
  const narrativePlan = await buildNarrativePlan({
    profile,
    mainTheme: req.mainTheme,
    subTheme: req.subTheme,
    sections: songSections,
    referenceLine: req.referenceLine,
  });

  let accumulated = "";
  let refined = false;
  let repetitionReduced = false;

  for (const section of songSections) {
    const targetDensity = sectionRhymeDensityTarget(section.tag);
    const rhymePlan = strongRhyme
      ? await buildRhymePlan({
          bars: section.lines,
          theme,
          artistVowelTails: artistTails,
          scheme: "CHAIN4",
          sectionTag: section.tag,
          targetDensity,
        })
      : null;
    const rhymeBlock = rhymePlan
      ? rhymePlan.promptBlock
      : `韻尾の目安: ${artistTails.slice(0, 3).map((tail) => formatVowelTail(tail)).join(" / ")}`;
    const draft = await generateSection({
      profile,
      bpm,
      section,
      previousLyrics: accumulated,
      referenceLine: req.referenceLine,
      rhymeBlock,
      narrativePlan,
      learningMode,
    });
    const deduped = await maybeReduceRepetition({
      lyrics: draft,
      profile,
      theme,
    });
    repetitionReduced = repetitionReduced || deduped.repetitionReduced;
    const refinedPart =
      strongRhyme && rhymePlan
        ? await maybeRefineRhymes({
            lyrics: deduped.lyrics,
            rhymePlan,
            profile,
            theme,
            enabled: true,
          })
        : null;
    const partLyrics = refinedPart?.lyrics ?? deduped.lyrics;
    refined = refined || Boolean(refinedPart?.refined);
    accumulated = accumulated
      ? `${accumulated}\n\n${partLyrics.trim()}`
      : partLyrics.trim();
  }

  const lyrics = accumulated;
  const rhymeMetrics = await measureRhymeMetrics(lyrics);

  return {
    lyrics,
    rhymeCoverage: rhymeMetrics.score,
    rhymeRefined: refined,
    repetitionReduced,
    sectionCount: songSections.length,
    lineCount,
    rhymeMetrics,
  };
}
