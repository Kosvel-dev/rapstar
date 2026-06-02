export type SectionType =
  | "Intro"
  | "Verse"
  | "Hook"
  | "Chorus"
  | "Pre-Chorus"
  | "Bridge"
  | "Outro";

export type SongSectionConfig = {
  id: string;
  type: SectionType;
  /** 小節数 ≒ ラップ行数 */
  bars: number;
};

export type SongSection = {
  tag: string;
  lines: number;
  note: string;
};

const SECTION_NOTES: Record<SectionType, string> = {
  Intro: "曲の入口。時間・場所・状況を一行で提示。小テーマの入口。",
  Verse: "物語の展開。具体描写（生き様・Pain・日常）。前パートの続き。",
  Hook: "パンチライン＋フック反復。曲の核心メッセージ。",
  Chorus: "Hookと同様。パンチラインを軸にキャッチーに。",
  "Pre-Chorus": "Hook/Chorus直前の橋。盛り上げ。話の緊張を上げる。",
  Bridge: "視点変更・対比。主軸テーマは維持。",
  Outro: "締め。余韻。モチーフへの一言。",
};

/** Masato「Ain't No Love」型 — Intro / Verse16 / Hook8 / Verse16 / Hook16 / Outro */
export const PRESET_AINT_NO_LOVE: SongSectionConfig[] = [
  { id: "s1", type: "Intro", bars: 4 },
  { id: "s2", type: "Verse", bars: 16 },
  { id: "s3", type: "Hook", bars: 8 },
  { id: "s4", type: "Verse", bars: 16 },
  { id: "s5", type: "Hook", bars: 16 },
  { id: "s6", type: "Outro", bars: 4 },
];

export const PRESET_SIMPLE: SongSectionConfig[] = [
  { id: "s1", type: "Intro", bars: 4 },
  { id: "s2", type: "Verse", bars: 16 },
  { id: "s3", type: "Hook", bars: 8 },
  { id: "s4", type: "Verse", bars: 16 },
  { id: "s5", type: "Hook", bars: 8 },
  { id: "s6", type: "Outro", bars: 4 },
];

export const PRESET_DRILL: SongSectionConfig[] = [
  { id: "s1", type: "Intro", bars: 4 },
  { id: "s2", type: "Verse", bars: 16 },
  { id: "s3", type: "Hook", bars: 8 },
  { id: "s4", type: "Verse", bars: 16 },
  { id: "s5", type: "Hook", bars: 16 },
  { id: "s6", type: "Outro", bars: 4 },
];

export function defaultStructureForArtist(slug: string): SongSectionConfig[] {
  if (slug === "pxrge-trxxxper" || slug === "sh1t" || slug === "yellow-bucks") {
    return PRESET_DRILL.map((s) => ({ ...s }));
  }
  return PRESET_AINT_NO_LOVE.map((s) => ({ ...s }));
}

export function configsToSections(configs: SongSectionConfig[]): SongSection[] {
  const verseCount = new Map<string, number>();
  return configs.map((c) => {
    let tag: string = c.type;
    if (c.type === "Verse" || c.type === "Hook" || c.type === "Chorus") {
      const n = (verseCount.get(c.type) ?? 0) + 1;
      verseCount.set(c.type, n);
      if (n > 1) tag = `${c.type} ${n}`;
    }
    return {
      tag,
      lines: c.bars,
      note: SECTION_NOTES[c.type],
    };
  });
}

export function totalBars(configs: SongSectionConfig[]): number {
  return configs.reduce((s, c) => s + c.bars, 0);
}

/** パート別の最低韻密度。Verse を最も厳しくする。 */
export function sectionRhymeDensityTarget(sectionTag: string): number {
  const normalized = sectionTag.toLowerCase();
  if (normalized.includes("verse")) return 70;
  if (normalized.includes("hook") || normalized.includes("chorus")) return 60;
  if (normalized.includes("intro")) return 40;
  if (normalized.includes("outro")) return 50;
  return 55;
}

export function newSectionId(): string {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const SECTION_TYPES: SectionType[] = [
  "Intro",
  "Verse",
  "Hook",
  "Chorus",
  "Pre-Chorus",
  "Bridge",
  "Outro",
];

export type ThemePreset = {
  label: string;
  mainTheme: string;
  subTheme: string;
};

export const THEME_PRESETS: Record<string, ThemePreset[]> = {
  "masato-hayashi": [
    {
      label: "Ain't No Love 風",
      mainTheme: "友情",
      subTheme:
        "Gangに愛はない。仲間に見せたい drama。血と涙で top へ。噂も時間も無視",
    },
    {
      label: "成り上がり × Pain",
      mainTheme: "成功",
      subTheme: "Pain と共に走る成り上がり。passion。あいつの声が鼓舞",
    },
    {
      label: "仲間・レース",
      mainTheme: "友情",
      subTheme: "いつ死ぬかわからん homies。孤独な街と dance。あいつの分の夢",
    },
  ],
  lex: [
    {
      label: "Logic 2 風",
      mainTheme: "成功",
      subTheme: "テンション上げて。力をくれ。有名人ぶりと本音のギャップ",
    },
    {
      label: "メロウ × トラップ",
      mainTheme: "愛情",
      subTheme: "湘南の夜。感情むき出し。XOXO。もう一度キスをして",
    },
  ],
  "bad-hop": [
    {
      label: "横浜クルー",
      mainTheme: "友情",
      subTheme: "仲間と416。Kawasaki Drift。Friends。街のリアル",
    },
  ],
  "yellow-bucks": [
    {
      label: "ドリル × 高テンション",
      mainTheme: "成功",
      subTheme: "Higher。攻撃的フロー。808と本音。頂点へ",
    },
  ],
  "verry-smol": [
    {
      label: "RAPSTAR 風",
      mainTheme: "成功",
      subTheme: "雨上がり。選ばれた5人。自分の物語を語る",
    },
  ],
  sh1t: [
    {
      label: "HOOD STAGE 風",
      mainTheme: "成功",
      subTheme: "ストリートから這い上がる。8point。本気のバース",
    },
  ],
  "son-si": [
    {
      label: "ストーリーラップ",
      mainTheme: "欲望",
      subTheme: "BBA Spice。日常と野心。フロウで魅せる",
    },
  ],
  kohjiya: [
    {
      label: "RAPSTAR 2024",
      mainTheme: "成功",
      subTheme: "Never Disappoint。優勝者のプライド。次のステージへ",
    },
  ],
};
