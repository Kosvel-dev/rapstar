/** 日本語ラップ向け: BPM から1行（1小節）の目標モーラ数を推定 */
export function targetMorasPerLine(
  bpm: number,
  beatsPerBar = 4,
  morasPerSecond = 3.2,
): number {
  if (bpm <= 0) return 8;
  const barDurationSec = (beatsPerBar * 60) / bpm;
  return Math.max(4, Math.round(barDurationSec * morasPerSecond));
}

/** BPM 別フロー指示文（LLM プロンプト用） */
export function bpmFlowInstruction(
  bpm: number,
  beatsPerBar = 4,
): string {
  const target = targetMorasPerLine(bpm, beatsPerBar);
  const tempo =
    bpm < 80 ? "ゆったり" : bpm < 110 ? "ミドル" : bpm < 140 ? "速め" : "ハイテンポ";

  return [
    `BPM ${bpm}（${tempo}）`,
    `${beatsPerBar}/4 拍子`,
    `1行 ≒ ${target} モーラ（ひらがな${target}文字前後）`,
    "行ごとの長さを揃え、リズムに乗る語感で書く",
  ].join(" / ");
}

/** モーラ数の標準偏差 */
export function stdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/** フロー均一性スコア (0〜100) */
export function flowUniformityScore(morasPerLine: number[]): number {
  if (morasPerLine.length === 0) return 0;
  const sd = stdDev(morasPerLine);
  return Math.max(0, Math.min(100, Math.round(100 - sd * 12)));
}
