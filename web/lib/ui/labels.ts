import type { DeliveryIntensity } from "@/lib/analysis/deliveryGuide";
import { INTENSITY_LABEL } from "@/lib/analysis/deliveryGuide";

/** 英語混ぜレベル → 日本語 */
export function englishMixLabel(level: "low" | "medium" | "high"): string {
  switch (level) {
    case "low":
      return "少なめ（日本語主体）";
    case "medium":
      return "中程度（アクセント程度）";
    case "high":
      return "多め（日英ミックス）";
  }
}

/** 母音列（ou, ai など）を読みやすい日本語に */
export function formatVowelTail(tail: string): string {
  if (!tail) return "—";
  const map: Record<string, string> = {
    a: "ア",
    i: "イ",
    u: "ウ",
    e: "エ",
    o: "オ",
  };
  const kana = [...tail].map((c) => map[c] ?? c).join("");
  return `${kana}（${tail}）`;
}

/** YouTube検索用ジャンル名 → 画面表示用 */
export function beatGenreLabel(genre: string): string {
  const labels: Record<string, string> = {
    "japanese hip hop type beat": "日本語HIP HOP",
    "boom bap type beat": "ブームバップ",
    "drill type beat": "ドリル",
    "hard trap type beat": "ハードトラップ",
    "dark trap instrumental": "ダークトラップ",
    "free type beat": "フリービート",
    youtube: "YouTube検索",
  };
  return labels[genre] ?? genre;
}

export const DELIVERY_LEGEND: { intensity: DeliveryIntensity; desc: string }[] =
  [
    { intensity: "shout", desc: "叫ぶ・テンションを上げる" },
    { intensity: "strong", desc: "力強く・はっきり" },
    { intensity: "normal", desc: "通常の語り" },
    { intensity: "adlib", desc: "アドリブ・コール" },
    { intensity: "whisper", desc: "抑えめ・メリハリ用" },
  ];

export function deliveryLegendText(): string {
  return DELIVERY_LEGEND.map(
    (d) => `${INTENSITY_LABEL[d.intensity]}: ${d.desc}`,
  ).join(" / ");
}

export const RHYME_HELP =
  "左の色付きライン = 同じ韻グループ。行末の母音（アイ・オウなど）が揃っていると韻が踏めています。";
