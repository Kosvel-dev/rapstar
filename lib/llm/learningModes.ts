export type LearningModeId =
  | "technical-chain"
  | "balanced-wordplay"
  | "battle-direct"
  | "introspective"
  | "melodic-street";

export type LearningMode = {
  id: LearningModeId;
  label: string;
  description: string;
  rhymeDensity: number;
  internalRhyme: number;
  multisyllable: number;
  story: number;
};

/**
 * 特定の実在ラッパーを模倣せず、学習したい技術要素を選ぶプリセット。
 */
export const LEARNING_MODES: LearningMode[] = [
  {
    id: "technical-chain",
    label: "技巧派チェーン",
    description: "4〜6音節の連続韻と内部韻を最優先",
    rhymeDensity: 85,
    internalRhyme: 80,
    multisyllable: 90,
    story: 60,
  },
  {
    id: "balanced-wordplay",
    label: "言葉遊びバランス",
    description: "意味、パンチライン、複数音節韻を均等に配分",
    rhymeDensity: 78,
    internalRhyme: 72,
    multisyllable: 80,
    story: 72,
  },
  {
    id: "battle-direct",
    label: "バトル直球",
    description: "伝わりやすい攻撃性と短いパンチラインを重視",
    rhymeDensity: 75,
    internalRhyme: 68,
    multisyllable: 74,
    story: 52,
  },
  {
    id: "introspective",
    label: "内省ストーリー",
    description: "具体描写と物語性を保ちながら韻を積む",
    rhymeDensity: 72,
    internalRhyme: 65,
    multisyllable: 72,
    story: 90,
  },
  {
    id: "melodic-street",
    label: "メロディック",
    description: "耳に残る反復と滑らかな母音列を重視",
    rhymeDensity: 70,
    internalRhyme: 62,
    multisyllable: 70,
    story: 68,
  },
];

export const DEFAULT_LEARNING_MODE: LearningModeId = "technical-chain";

export function getLearningMode(id?: string): LearningMode {
  return (
    LEARNING_MODES.find((mode) => mode.id === id) ??
    LEARNING_MODES.find((mode) => mode.id === DEFAULT_LEARNING_MODE)!
  );
}

export function learningModePromptBlock(mode: LearningMode): string {
  return `## 学習モード: ${mode.label}
- 韻密度目標: ${mode.rhymeDensity}%
- 内部韻の強さ: ${mode.internalRhyme}/100
- マルチシラブル韻の強さ: ${mode.multisyllable}/100
- 物語性: ${mode.story}/100
- 方針: ${mode.description}`;
}
