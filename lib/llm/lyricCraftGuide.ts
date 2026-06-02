/**
 * 作詞ガイド（シオサバ「ラップの作詞」記事を要約）
 * https://siosaba.net/kiji-list/creative/rap-edit-lyric-pro/
 * https://siosaba.net/kiji-list/creative/rap-yougo/
 */

export const MAIN_THEME_CATEGORIES = [
  "欲望",
  "お金",
  "友情",
  "成功",
  "愛情",
  "政治",
  "お酒",
] as const;

/** 作詞の基本姿勢 */
export const LYRIC_CRAFT_PRINCIPLES = `【作詞の基本 — シオサバ流】
- 歌唱力より個性。物語より「自分の生き様・リアルな体験」
- 正確さよりユーモア。口癖や友達の言い方をそのまま活かしてよい
- 1曲の主軸テーマは1つに絞る（欲望/お金/友情/成功/愛情/政治/お酒）
- 大テーマ＋小テーマ（人物名・店名・地名・部署名など具体）を最初に決める
- 各パートに「細かいテーマ」（場面・時間・誰が何をしたか）を割り当ててから書く
- 曲中で必ず1つ「パンチライン」（覚えて帰ってほしいキラーフレーズ）を置く
- 韻は「聞き心地」優先。文字数だけ揃えた硬い韻より、母音が自然に響く韻
- 「好き」「友情」等をそのまま書くより、情景描写で伝える
- 無理な倒置法（語順入れ替え）は避け、伝わる語順で書く`;

/** 話の統一感 */
export const NARRATIVE_COHESION_RULES = `【話の統一感 — 厳守】
- 1曲＝1本の話。Introで状況設定 → Verseで展開 → Hookでパンチライン → 後半Verseで深掘り → Outroで余韻
- 決めた固有名詞・場所・人物・モチーフは曲を通して一貫させる（途中で別の話に飛ばない）
- 各パートは「前のパートの直後の時間・場面」として書く
- テーマが散らばらないよう、主軸から外れるエピソードは入れない
- Hook/サビは同じパンチライン・同じ核心メッセージを軸に（言い換えは可、別テーマ不可）`;

/** 生成用ラップ用語（自然に混ぜる。毎行使わない） */
export const RAP_SLANG_VOCAB = {
  structure: [
    "フロウ",
    "フック",
    "ブリッジ",
    "バース",
    "リリック",
    "ライム",
    "パンチライン",
    "インスト",
    "サイファー",
    "フリースタイル",
  ],
  positive: [
    "ドープ",
    "スワッグ",
    "ホーミー",
    "ホーミーズ",
    "マイメン",
    "クルー",
    "レペゼン",
    "フッド",
    "プロップス",
    "リスペクト",
    "フックアップ",
  ],
  scene: [
    "ゲットー",
    "インダハウス",
    "ビート",
    "トラック",
    "BPM",
    "マイク",
    "ステージ",
    "アンセム",
  ],
  attitude: [
    "リアル",
    "本気",
    "本番",
    "頂点",
    "成り上がり",
    "アンチ",
    "ヘイター",
  ],
};

export function rapSlangPromptBlock(): string {
  const pick = (label: string, words: string[]) =>
    `- ${label}: ${words.join("、")}`;
  return [
    "## ラップ用語（自然に混ぜる。1曲に2〜5語程度。毎行入れない）",
    pick("構成", RAP_SLANG_VOCAB.structure),
    pick("仲間・場", RAP_SLANG_VOCAB.positive),
    pick("シーン", RAP_SLANG_VOCAB.scene),
    pick("姿勢", RAP_SLANG_VOCAB.attitude),
  ].join("\n");
}

export function lyricCraftSystemBlock(): string {
  return [LYRIC_CRAFT_PRINCIPLES, NARRATIVE_COHESION_RULES, rapSlangPromptBlock()].join(
    "\n\n",
  );
}

export function punchlineInstruction(): string {
  return `【パンチライン】
- Hook/Chorus に必ず1つ「この曲の顔」になるフレーズを置く
- 職業・地名・日常の言葉で韻を尖らせる（月並み2文字漢字韻だけにしない）
- パンチラインは曲を通して同じ核心を指す（言い換え・反復はHookのみ2回まで可）`;
}
