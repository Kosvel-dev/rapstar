import type { LineAnalysis } from "./types";

export type DeliveryIntensity =
  | "shout"
  | "strong"
  | "normal"
  | "adlib"
  | "whisper";

export type DeliveryLineGuide = {
  index: number;
  text: string;
  intensity: DeliveryIntensity;
  note: string;
  moras: number;
};

const SHOUT_PATTERN = /[A-Z]{3,}|!{2,}|^(Boom|Yeah|Yo|Let's go|GAME CHANGER)/i;
const ADLIB_PATTERN = /^\(.*\)$|^(Ah,?\s*huh|Huh|Yeah|Yo|Okay|Wassup)/i;
const STRONG_PATTERN = /!$|^(No way back|I trust|I'm so bad|REVENGE|OVER KILL)/i;

export function analyzeDeliveryGuide(
  lines: LineAnalysis[],
): DeliveryLineGuide[] {
  const avgMoras =
    lines.length > 0
      ? lines.reduce((s, l) => s + l.moras, 0) / lines.length
      : 8;

  return lines.map((line) => {
    const text = line.text;
    let intensity: DeliveryIntensity = "normal";
    let note = "通常の語り — リズムに乗せて";

    if (ADLIB_PATTERN.test(text.trim()) || /\(.*\)/.test(text) && text.length < 30) {
      intensity = "adlib";
      note = "アドリブ / コール — 裏声〜ハスキー寄り、ビートの隙間に";
    } else if (SHOUT_PATTERN.test(text)) {
      intensity = "shout";
      note = "シャウト / 強調 — 喉を開いて、腹から。ここでテンションを上げる";
    } else if (STRONG_PATTERN.test(text.trim())) {
      intensity = "strong";
      note = "強め — 1音1音はっきり、フック向き";
    } else if (line.moras >= avgMoras + 4) {
      intensity = "strong";
      note = "速口 — 息継ぎを事前に決めて、タンッと区切る";
    } else if (line.moras <= avgMoras - 3 && line.moras <= 6) {
      intensity = "whisper";
      note = "抑えめ — 直前のシャウトとのメリハリ用";
    }

    if (/[a-zA-Z]{4,}/.test(text) && intensity === "normal") {
      note = "英語フレーズ — ネイティブ寄りの発音でキメる";
    }

    return {
      index: line.index,
      text,
      intensity,
      note,
      moras: line.moras,
    };
  });
}

export const INTENSITY_LABEL: Record<DeliveryIntensity, string> = {
  shout: "シャウト",
  strong: "強め",
  normal: "通常",
  adlib: "アドリブ",
  whisper: "抑えめ",
};

export const INTENSITY_COLOR: Record<DeliveryIntensity, string> = {
  shout: "border-red-500/60 bg-red-950/40",
  strong: "border-amber-500/60 bg-amber-950/30",
  normal: "border-zinc-700 bg-zinc-900/40",
  adlib: "border-purple-500/50 bg-purple-950/30",
  whisper: "border-blue-500/40 bg-blue-950/20",
};
