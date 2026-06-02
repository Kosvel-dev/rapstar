/** カタカナ → ひらがな */
export function toHiragana(text: string): string {
  return text.replace(/[\u30a1-\u30f6]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0x60),
  );
}

/** テキストがかな主体か */
export function isMostlyKana(text: string): boolean {
  if (!text) return false;
  const kana = text.match(/[\u3040-\u309f\u30a0-\u30ff]/g)?.length ?? 0;
  return kana / text.length >= 0.5;
}

/** ひらがな1文字の母音 (a/i/u/e/o) */
function moraVowel(char: string): string | null {
  const map: Record<string, string> = {
    あ: "a", い: "i", う: "u", え: "e", お: "o",
    か: "a", き: "i", く: "u", け: "e", こ: "o",
    さ: "a", し: "i", す: "u", せ: "e", そ: "o",
    た: "a", ち: "i", つ: "u", て: "e", と: "o",
    な: "a", に: "i", ぬ: "u", ね: "e", の: "o",
    は: "a", ひ: "i", ふ: "u", へ: "e", ほ: "o",
    ま: "a", み: "i", む: "u", め: "e", も: "o",
    や: "a", ゆ: "u", よ: "o",
    ら: "a", り: "i", る: "u", れ: "e", ろ: "o",
    わ: "a", を: "o", ん: "n",
    が: "a", ぎ: "i", ぐ: "u", げ: "e", ご: "o",
    ざ: "a", じ: "i", ず: "u", ぜ: "e", ぞ: "o",
    だ: "a", ぢ: "i", づ: "u", で: "e", ど: "o",
    ば: "a", び: "i", ぶ: "u", べ: "e", ぼ: "o",
    ぱ: "a", ぴ: "i", ぷ: "u", ぺ: "e", ぽ: "o",
    ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
    ゃ: "a", ゅ: "u", ょ: "o",
    ゎ: "a", ゐ: "i", ゑ: "e",
  };
  return map[char] ?? null;
}

const SMALL_KANA = "ゃゅょぁぃぅぇぉ";

/** ひらがな読み → 母音列（nwnwn 形式に近い） */
export function vowelsFromReading(reading: string): string {
  const hira = toHiragana(reading);
  let vowels = "";
  for (let i = 0; i < hira.length; i++) {
    const ch = hira[i];
    if (ch === "っ" || ch === "ー" || ch === "ん") continue;
    const next = hira[i + 1];
    if (next && SMALL_KANA.includes(next)) {
      const v = moraVowel(next);
      if (v && v !== "n") vowels += v;
      i++;
      continue;
    }
    const v = moraVowel(ch);
    if (v && v !== "n") vowels += v;
  }
  return vowels;
}

/** ひらがな読み → モーラ数 */
export function countMoras(reading: string): number {
  const hira = toHiragana(reading);
  let count = 0;
  for (let i = 0; i < hira.length; i++) {
    const ch = hira[i];
    if (ch === "ー") {
      count++;
      continue;
    }
    if (ch === "っ") {
      count++;
      continue;
    }
    const next = hira[i + 1];
    if (next && SMALL_KANA.includes(next)) {
      count++;
      i++;
      continue;
    }
    if (moraVowel(ch) || ch === "ん") count++;
  }
  return Math.max(count, 1);
}

/** 末尾N母音を取得 */
export function vowelTail(vowels: string, length = 2): string {
  if (!vowels) return "";
  return vowels.slice(-Math.max(1, length));
}

/** 母音 tail の一致度 (0〜1) */
export function tailMatchScore(a: string, b: string, minTail = 2): number {
  if (!a || !b) return 0;
  const maxLen = Math.min(a.length, b.length, 4);
  for (let len = maxLen; len >= minTail; len--) {
    if (a.slice(-len) === b.slice(-len)) {
      return len / 4;
    }
  }
  return 0;
}
