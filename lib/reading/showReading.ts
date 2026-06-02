import { isMostlyKana, toHiragana } from "@/lib/analysis/kana";

function stripReadingAnnotations(text: string): string {
  return text.replace(/（[^）]*）/g, "").replace(/\([^)]*\)/g, "").trim();
}

export function shouldShowReadingForLine(text: string, reading: string): boolean {
  if (!reading) return false;
  const base = stripReadingAnnotations(text);
  if (/[\u4e00-\u9fff]/.test(base)) return true;
  if (isMostlyKana(base)) return false;
  const normText = toHiragana(
    base.replace(/[^\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fffA-Za-z]/g, ""),
  );
  const normReading = toHiragana(reading);
  return normText !== normReading;
}
