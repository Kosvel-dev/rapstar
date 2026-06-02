import type { ArtistProfile } from "@/lib/artist/types";
import { deepseekChat } from "@/lib/llm/deepseekChat";
import {
  MAIN_THEME_CATEGORIES,
  LYRIC_CRAFT_PRINCIPLES,
  punchlineInstruction,
} from "@/lib/llm/lyricCraftGuide";
import type { SongSection } from "@/lib/llm/songStructure";
import { combineTheme, type LyricThemeInput } from "@/lib/llm/themeInput";

export type SectionNarrative = {
  tag: string;
  microTheme: string;
  scene: string;
};

export type NarrativePlan = {
  mainTheme: string;
  subTheme: string;
  anchors: string[];
  punchline: string;
  hookPhrase: string;
  storySummary: string;
  sections: SectionNarrative[];
};

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

function fallbackSection(tag: string, theme: string): SectionNarrative {
  const lower = tag.toLowerCase();
  if (lower.includes("intro")) {
    return { tag, microTheme: "状況設定", scene: `${theme}の入口。時間・場所を一行で` };
  }
  if (lower.includes("hook") || lower.includes("chorus")) {
    return { tag, microTheme: "パンチライン", scene: "曲の核心フレーズ。テンション高め" };
  }
  if (lower.includes("outro")) {
    return { tag, microTheme: "余韻", scene: "テーマへの一言で締める" };
  }
  if (lower.includes("bridge")) {
    return { tag, microTheme: "視点転換", scene: "Verseとの対比。新しい角度" };
  }
  return { tag, microTheme: "展開", scene: `${theme}の具体エピソード` };
}

function normalizePlan(
  raw: Partial<NarrativePlan>,
  sections: SongSection[],
  theme: string,
  userTheme?: LyricThemeInput,
): NarrativePlan {
  const sectionMap = new Map(
    (raw.sections ?? []).map((s) => [s.tag, s] as const),
  );
  const mainTheme = userTheme?.mainTheme.trim() || raw.mainTheme?.trim() || "成功";
  const subTheme = userTheme?.subTheme.trim() || raw.subTheme?.trim() || theme;

  return {
    mainTheme,
    subTheme,
    anchors: (raw.anchors ?? []).filter(Boolean).slice(0, 6),
    punchline: raw.punchline?.trim() || subTheme,
    hookPhrase: raw.hookPhrase?.trim() || raw.punchline?.trim() || subTheme,
    storySummary:
      raw.storySummary?.trim() ||
      `${mainTheme}（${subTheme}）を軸に、一貫した場面描写で曲を構成する`,
    sections: sections.map((sec) => {
      const planned = sectionMap.get(sec.tag);
      if (planned?.microTheme && planned?.scene) return planned;
      return fallbackSection(sec.tag, subTheme);
    }),
  };
}

export async function buildNarrativePlan(options: {
  profile: ArtistProfile;
  mainTheme: string;
  subTheme: string;
  sections: SongSection[];
  referenceLine?: string;
}): Promise<NarrativePlan> {
  const combinedTheme = combineTheme({
    mainTheme: options.mainTheme,
    subTheme: options.subTheme,
  });
  const userTheme: LyricThemeInput = {
    mainTheme: options.mainTheme,
    subTheme: options.subTheme,
  };
  const sectionList = options.sections
    .map((s) => `- ${s.tag} (${s.lines}行): ${s.note}`)
    .join("\n");

  const system = `あなたは日本語ラップの構成作家です。
1曲分の「話の設計図」だけをJSONで出力します。歌詞本文は書かない。

${LYRIC_CRAFT_PRINCIPLES}

${punchlineInstruction()}`;

  const user = [
    `# アーティスト: ${options.profile.name}`,
    `# ユーザー指定 大テーマ（主軸）: ${options.mainTheme}`,
    `# ユーザー指定 小テーマ（具体）: ${options.subTheme}`,
    options.referenceLine ? `# 参考雰囲気: ${options.referenceLine}` : "",
    `# 主軸テーマ候補: ${MAIN_THEME_CATEGORIES.join("、")} — 大テーマはユーザー指定をそのまま使う`,
    "",
    "## 曲構成",
    sectionList,
    "",
    "出力: 以下のJSONのみ（説明不要）",
    "```json",
    `{`,
    `  "mainTheme": "主軸テーマ1つ",`,
    `  "subTheme": "小テーマ（人物名・店名・地名・具体的状況）",`,
    `  "anchors": ["曲中で繰り返す固有名詞やモチーフ", "..."],`,
    `  "punchline": "Hookの核になるパンチライン1文",`,
    `  "hookPhrase": "Hookで反復する短いフレーズ",`,
    `  "storySummary": "曲全体の話の流れを3〜4文",`,
    `  "sections": [`,
    `    { "tag": "Intro", "microTheme": "このパートの細テーマ", "scene": "書く場面・時間・誰が何を" }`,
    `  ]`,
    `}`,
    "```",
    "",
    "sections の tag は曲構成のタグと完全一致させる。",
    "mainTheme と subTheme はユーザー指定をそのまま JSON に入れる。",
    "話は1本道。後半ほど深く、別の話題に逸れない。",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await deepseekChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens: 900,
    thinking: false,
    temperature: 0.65,
  });

  try {
    const parsed = JSON.parse(extractJson(raw)) as Partial<NarrativePlan>;
    return normalizePlan(parsed, options.sections, combinedTheme, userTheme);
  } catch {
    return normalizePlan({}, options.sections, combinedTheme, userTheme);
  }
}

export async function buildMiniNarrativePlan(options: {
  profile: ArtistProfile;
  mainTheme: string;
  subTheme: string;
  bars: number;
  referenceLine?: string;
}): Promise<NarrativePlan> {
  const pseudoSections: SongSection[] = [
    {
      tag: "Verse",
      lines: options.bars,
      note: "短尺。起→承→結の1本道",
    },
  ];
  return buildNarrativePlan({
    profile: options.profile,
    mainTheme: options.mainTheme,
    subTheme: options.subTheme,
    sections: pseudoSections,
    referenceLine: options.referenceLine,
  });
}

export function narrativePlanPromptBlock(
  plan: NarrativePlan,
  sectionTag?: string,
): string {
  const section = sectionTag
    ? plan.sections.find((s) => s.tag === sectionTag)
    : undefined;

  const lines = [
    "## 話の設計図（この通りに書く — 統一感最優先）",
    `- 主軸テーマ: ${plan.mainTheme}`,
    `- 小テーマ: ${plan.subTheme}`,
    `- 物語の流れ: ${plan.storySummary}`,
    plan.anchors.length > 0
      ? `- 曲を通すモチーフ: ${plan.anchors.join("、")}`
      : "",
    `- パンチライン: ${plan.punchline}`,
    `- Hookフレーズ: ${plan.hookPhrase}`,
  ].filter(Boolean);

  if (section) {
    lines.push(
      "",
      `### 今書く [${section.tag}] の細テーマ`,
      `- 細テーマ: ${section.microTheme}`,
      `- 場面: ${section.scene}`,
      "- 前パートの続きとして書く。別の話にしない。",
    );
  }

  return lines.join("\n");
}
