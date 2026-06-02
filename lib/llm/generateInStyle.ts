import { bpmFlowInstruction } from "@/lib/analysis/bpm";
import type { ArtistProfile } from "@/lib/artist/types";
import { deepseekChat } from "@/lib/llm/deepseekChat";
import { measureRhymeCoverage, maybeRefineRhymes } from "@/lib/llm/refineRhymes";
import { buildRhymePlan, type RhymeScheme } from "@/lib/llm/rhymePlan";
import { formatVowelTail } from "@/lib/ui/labels";

export type GenerateInStyleRequest = {
  artistProfile: ArtistProfile;
  theme: string;
  bpm?: number;
  bars?: 4 | 8 | 16;
  referenceLine?: string;
  /** 韻を強めに生成 + 不足時は自動修正 */
  strongRhyme?: boolean;
};

export type GenerateInStyleResult = {
  lyrics: string;
  rhymeCoverage: number;
  rhymeRefined: boolean;
};

export async function generateLyricsInStyle(
  req: GenerateInStyleRequest,
): Promise<GenerateInStyleResult> {
  const bars = req.bars ?? 8;
  const bpm = req.bpm ?? 110;
  const profile = req.artistProfile;
  const strongRhyme = req.strongRhyme !== false;

  const topWords = profile.vocabulary.topWords
    .slice(0, 15)
    .map((w) => w.word)
    .join("、");

  const artistTails = profile.rhyme.commonEndVowelTails.map((v) => v.tail);
  const scheme: RhymeScheme = "AABB";
  const rhymePlan = strongRhyme
    ? await buildRhymePlan({
        bars,
        theme: req.theme,
        artistVowelTails: artistTails,
        scheme,
      })
    : null;

  const vowelHint =
    artistTails.length > 0
      ? artistTails.slice(0, 4).map((t) => formatVowelTail(t)).join(" / ")
      : "オウ（ou） / アイ（ai）";

  const system = strongRhyme
    ? `あなたは日本語ラップの作詞家です。韻（ライム）を最優先に歌詞を書きます。
指定アーティストの文体に寄せつつ、行末の母音韵を必ずスキーム通りに揃えてください。
既存フレーズの丸写しは禁止。

【韻の書き方 — 厳守】
1. 各行の「最後の語」の読みの末尾2母音をスキームに合わせる
2. 2行セットで同じ韻尾（AABB）— 1行目と2行目は同じ韻、3行目と4行目は別韻
3. 韻候補語があれば行末に積極的に使う
4. 韻のために1行を短く切る・語順を入れ替えるのはOK
5. 内部韻（行中の母音の反復）も1〜2箇所

悪い例: 各行末がバラバラ（あ/い/う/え）
良い例（AABB・ou）:
  夜の街を駆け抜けるフロウ
  誰も止められないこの行路
  頂点を狙う俺のスタイル
  アンチの声も全部サイレン`
    : `あなたは日本語ラップの作詞家です。
指定アーティストの文体・韻・フローに寄せて歌詞を書きます。
2行ごとに行末の母音韵を揃える（AABB）。`;

  const userParts = [
    `# アーティスト: ${profile.name}`,
    `## 文体サマリー\n${profile.delivery.styleSummary}`,
    `## 特徴\n${profile.delivery.traits.join("、") || "なし"}`,
    `## 語彙傾向\n${topWords}`,
    strongRhyme && rhymePlan
      ? rhymePlan.promptBlock
      : `## 韻\nよく使う韻尾: ${vowelHint} — 2行ごとに揃える`,
    `## フロー\n平均 ${profile.flow.averageMorasPerLine} モーラ/行、均一性 ${profile.flow.uniformityScore}/100`,
    `## 英語混ぜ\n${profile.delivery.englishMixLevel}`,
    "",
    `# 今回の条件`,
    `テーマ: ${req.theme}`,
    bpmFlowInstruction(bpm),
    `行数: 正確に ${bars} 行（セクション見出し [Verse] 等は行数に含めない）`,
    req.referenceLine ? `参考雰囲気: ${req.referenceLine}` : "",
    "",
    strongRhyme
      ? "出力: 歌詞本文のみ。ラップ行は必ず指定行数。各行末の韻尾をスキーム通りに。"
      : "出力: 歌詞本文のみ。[Verse] [Hook] 等OK。",
  ].filter(Boolean);

  const draft = await deepseekChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: userParts.join("\n") },
    ],
    maxTokens: bars <= 4 ? 700 : bars <= 8 ? 1100 : 1600,
    thinking: false,
    temperature: strongRhyme ? 0.78 : 0.85,
  });

  if (!strongRhyme || !rhymePlan) {
    const coverage = await measureRhymeCoverage(draft);
    return { lyrics: draft, rhymeCoverage: coverage, rhymeRefined: false };
  }

  const { lyrics, coverage, refined } = await maybeRefineRhymes({
    lyrics: draft,
    rhymePlan,
    profile,
    theme: req.theme,
    enabled: true,
  });

  return { lyrics, rhymeCoverage: coverage, rhymeRefined: refined };
}
