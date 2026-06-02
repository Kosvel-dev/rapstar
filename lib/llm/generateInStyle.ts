import { bpmFlowInstruction } from "@/lib/analysis/bpm";
import type { ArtistProfile } from "@/lib/artist/types";
import { deepseekChat } from "@/lib/llm/deepseekChat";

export type GenerateInStyleRequest = {
  artistProfile: ArtistProfile;
  theme: string;
  bpm?: number;
  bars?: 4 | 8 | 16;
  referenceLine?: string;
};

export async function generateLyricsInStyle(
  req: GenerateInStyleRequest,
): Promise<string> {
  const bars = req.bars ?? 8;
  const bpm = req.bpm ?? 110;
  const profile = req.artistProfile;

  const topWords = profile.vocabulary.topWords
    .slice(0, 15)
    .map((w) => w.word)
    .join("、");

  const vowelTails = profile.rhyme.commonEndVowelTails
    .slice(0, 6)
    .map((v) => v.tail)
    .join(" / ");

  const system = `あなたは日本語ラップの作詞家です。
指定アーティストの文体・韻・フロー・歌い方に寄せて歌詞を書きます。
既存フレーズの丸写しは禁止。オリジナルだが特徴は再現してください。

【韻のルール — 最重要】
- 2行ごと、または4行ごとに行末の母音韵を揃える（AABB または AAAA）
- 同じ韻グループは最低2行以上
- 内部韻（行の途中で同系統の音）も1〜2箇所入れる
- 韻のために不自然な語順にはしない`;

  const rhymeInstruction = vowelTails
    ? `このアーティストがよく使う韻尾母音: ${vowelTails} — 行末に意識して踏む`
    : "行末の母音を2行単位で揃える";

  const user = [
    `# アーティスト: ${profile.name}`,
    `## 文体サマリー\n${profile.delivery.styleSummary}`,
    `## 特徴\n${profile.delivery.traits.join("、") || "なし"}`,
    `## 語彙傾向\n${topWords}`,
    `## ${rhymeInstruction}`,
    `## フロー\n平均 ${profile.flow.averageMorasPerLine} モーラ/行、均一性 ${profile.flow.uniformityScore}/100`,
    `## 英語混ぜ\n${profile.delivery.englishMixLevel}`,
    `## 歌い方\nシャウト・アドリブ・英語フレーズを適所に（フックは強め）`,
    "",
    `# 今回の条件`,
    `テーマ: ${req.theme}`,
    bpmFlowInstruction(bpm),
    `行数: 約${bars}行`,
    req.referenceLine ? `参考雰囲気: ${req.referenceLine}` : "",
    "",
    "出力: 歌詞本文のみ。[Verse] [Hook] 等OK。韻が取れていることを行末で意識。",
  ]
    .filter(Boolean)
    .join("\n");

  return deepseekChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens: bars <= 4 ? 600 : bars <= 8 ? 1000 : 1500,
    thinking: false,
    temperature: 0.85,
  });
}
