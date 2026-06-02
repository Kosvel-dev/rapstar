/** 語句の読み・母音解析結果 */
export type WordAnalysis = {
  surface: string;
  reading: string;
  vowels: string;
  moras: number;
};

/** 行ごとの解析 */
export type LineAnalysis = {
  index: number;
  text: string;
  /** 行全体の読み（ひらがな） */
  reading: string;
  endUnit: string;
  endReading: string;
  endVowels: string;
  moras: number;
  tokens: WordAnalysis[];
};

/** 韻の一致（行末 or 内部） */
export type RhymeMatch = {
  type: "end" | "internal";
  wordA: string;
  wordB: string;
  vowelsA: string;
  vowelsB: string;
  tail: string;
  lineIndexA: number;
  lineIndexB: number;
  strength: number;
};

/** フロー分析 */
export type FlowAnalysis = {
  morasPerLine: number[];
  averageMoras: number;
  stdDevMoras: number;
  uniformityScore: number;
  bpm?: number;
  targetMorasPerLine?: number;
  beatsPerBar: number;
};

/** 韻密度スコア内訳 */
export type RhymeDensityBreakdown = {
  endRhyme: number;
  internalRhyme: number;
  inputWordUsage: number;
  flowUniformity: number;
  overall: number;
};

/** 歌詞全体の解析結果 */
export type LyricAnalysis = {
  lines: LineAnalysis[];
  rhymeMatches: RhymeMatch[];
  flow: FlowAnalysis;
  density: RhymeDensityBreakdown;
  /** 論文ベース韻品質（P9-3 参考） */
  rhymeQuality?: {
    rhymeLengthScore: number;
    lowDuplicationScore: number;
    avgSuffixSimilarity: number;
    moraRangeScore: number;
    moraBalanceScore: number;
    overallQuality: number;
  };
};

/** AI添削結果 */
export type LyricCritique = {
  summary: string;
  strengths: string[];
  improvements: string[];
  suggestedLines?: string[];
};
