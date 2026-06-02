import { bpmFlowInstruction } from "@/lib/analysis/bpm";
import type { ArtistProfile } from "@/lib/artist/types";
import { deepseekChat } from "@/lib/llm/deepseekChat";
import { buildRhymePlan } from "@/lib/llm/rhymePlan";
import {
  measureRhymeCoverage,
  maybeRefineRhymes,
} from "@/lib/llm/refineRhymes";
import {
  configsToSections,
  type SongSection,
  type SongSectionConfig,
  totalBars,
} from "@/lib/llm/songStructure";
import { formatVowelTail } from "@/lib/ui/labels";

export type GenerateFullSongRequest = {
  artistProfile: ArtistProfile;
  theme: string;
  bpm?: number;
  sections: SongSectionConfig[];
  referenceLine?: string;
  strongRhyme?: boolean;
};

export type GenerateFullSongResult = {
  lyrics: string;
  rhymeCoverage: number;
  rhymeRefined: boolean;
  sectionCount: number;
  lineCount: number;
};

async function generateSection(options: {
  profile: ArtistProfile;
  theme: string;
  bpm: number;
  section: SongSection;
  previousLyrics: string;
  referenceLine?: string;
  rhymeBlock?: string;
}): Promise<string> {
  const { profile, theme, bpm, section, previousLyrics, referenceLine, rhymeBlock } =
    options;

  const system = `あなたは日本語ラップの作詞家です。
曲の一部（${section.tag}）だけを書きます。指定行数（小節数）を厳守。
既存曲の丸写し禁止。アーティストの文体に寄せる。
韻は2行ごと（AABB）で行末母音を揃える。`;

  const user = [
    `# アーティスト: ${profile.name}`,
    `## 文体\n${profile.delivery.styleSummary}`,
    `## 語彙\n${profile.vocabulary.topWords.slice(0, 12).map((w) => w.word).join("、")}`,
    rhymeBlock ?? "",
    "",
    `# 曲全体のテーマ\n${theme}`,
    bpmFlowInstruction(bpm),
    referenceLine ? `# 参考雰囲気\n${referenceLine}` : "",
    "",
    `# 今書くパート: [${section.tag}]`,
    `小節数（行数）: 正確に ${section.lines} 行`,
    `このパートの方向性: ${section.note}`,
    previousLyrics
      ? `\n# すでに書いた部分（流れ・語彙を合わせる）\n${previousLyrics}`
      : "",
    "",
    `出力: [${section.tag}] タグ1行 + 歌詞 ${section.lines} 行のみ。他セクションは書かない。`,
  ]
    .filter(Boolean)
    .join("\n");

  return deepseekChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens:
      section.lines <= 4 ? 400 : section.lines <= 8 ? 700 : section.lines <= 16 ? 1200 : 1600,
    thinking: false,
    temperature: 0.8,
  });
}

export async function generateFullSongLyrics(
  req: GenerateFullSongRequest,
): Promise<GenerateFullSongResult> {
  const bpm = req.bpm ?? 110;
  const profile = req.artistProfile;
  const strongRhyme = req.strongRhyme !== false;
  const songSections = configsToSections(req.sections);
  const lineCount = totalBars(req.sections);

  if (songSections.length === 0) {
    throw new Error("曲構成が空です");
  }

  const artistTails = profile.rhyme.commonEndVowelTails.map((v) => v.tail);
  const rhymePlan = strongRhyme
    ? await buildRhymePlan({
        bars: Math.min(lineCount, 48),
        theme: req.theme,
        artistVowelTails: artistTails,
        scheme: "AABB",
      })
    : null;

  const rhymeBlock = rhymePlan
    ? `${rhymePlan.promptBlock}\n（曲全体を通して同系統の韻尾を使う）`
    : `韻尾の目安: ${artistTails.slice(0, 3).map((t) => formatVowelTail(t)).join(" / ")}`;

  let accumulated = "";

  for (const section of songSections) {
    const part = await generateSection({
      profile,
      theme: req.theme,
      bpm,
      section,
      previousLyrics: accumulated,
      referenceLine: req.referenceLine,
      rhymeBlock,
    });
    accumulated = accumulated ? `${accumulated}\n\n${part.trim()}` : part.trim();
  }

  let lyrics = accumulated;
  let coverage = await measureRhymeCoverage(lyrics);
  let refined = false;

  if (strongRhyme && rhymePlan && coverage < 45) {
    const result = await maybeRefineRhymes({
      lyrics,
      rhymePlan,
      profile,
      theme: req.theme,
      enabled: true,
    });
    lyrics = result.lyrics;
    coverage = result.coverage;
    refined = result.refined;
  }

  return {
    lyrics,
    rhymeCoverage: coverage,
    rhymeRefined: refined,
    sectionCount: songSections.length,
    lineCount,
  };
}
