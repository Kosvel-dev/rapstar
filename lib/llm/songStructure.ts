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
  Intro: "曲の入口。テーマを短く提示。印象的に。",
  Verse: "物語・描写。具体性。成り上がり・Pain・日常のディテール。",
  Hook: "フック。繰り返しやすい。テンション高め。キャッチーな語句。",
  Chorus: "サビ。Hook と同様にフック反復。英語フレーズ混ぜ可。",
  "Pre-Chorus": "Hook/Chorus 直前の橋。盛り上げ。",
  Bridge: "展開・視点変更。Verse との対比。",
  Outro: "締め。余韻。仲間・テーマへの一言。",
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
  if (slug === "pxrge-trxxxper") return PRESET_DRILL.map((s) => ({ ...s }));
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

export const THEME_PRESETS: Record<
  string,
  { label: string; theme: string }[]
> = {
  "masato-hayashi": [
    {
      label: "Ain't No Love 風",
      theme:
        "Gangに愛はない。仲間に見せたい drama。血と涙で top へ。噂も時間も無視",
    },
    {
      label: "成り上がり × Pain",
      theme: "Pain と共に走る成り上がり。passion。あいつの声が鼓舞",
    },
    {
      label: "仲間・レース",
      theme: "いつ死ぬかわからん homies。孤独な街と dance。あいつの分の夢",
    },
  ],
};
