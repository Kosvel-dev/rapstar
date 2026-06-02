/**
 * LLM が韻用に足したゴミ（**相**、末尾 I 等）を除去
 */
export function sanitizeGeneratedLyrics(text: string): string {
  const lines = text.split("\n");
  const cleaned = lines.map((line) => {
    let l = line;
    // セクションタグはそのまま
    if (/^\s*\[.+\]\s*$/.test(l)) return l;

    // 行末の **語** 韻ダンプ
    l = l.replace(/\s+[\*＊]{2}[^*\n＊]{1,16}[\*＊]{2}\s*$/u, "");
    // 行末の 【アイ】 [I] 等
    l = l.replace(/\s*[\[［【][^\]］】\n]{1,10}[\]］】]\s*$/u, "");
    // 日本語の直後に単独 I / AI
    l = l.replace(
      /([\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff])\s+(I|AI|i)\s*$/u,
      "$1",
    );
    // 「…りゃ アア」のような母音だけの行末足し
    l = l.replace(
      /\s+(アア|ああ|アイ|エイ|オウ|相|艾|亜依|麻系|愛衣|歩衣)\s*$/u,
      "",
    );
    return l.replace(/\s{2,}/g, " ").trimEnd();
  });
  return cleaned.join("\n");
}
