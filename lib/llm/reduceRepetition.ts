import type { ArtistProfile } from "@/lib/artist/types";
import { extractRapLines } from "@/lib/artist/cleanLyrics";
import {
  analyzeOveruse,
  overuseSummaryForPrompt,
} from "@/lib/llm/antiRepetition";
import { deepseekChat } from "@/lib/llm/deepseekChat";

export async function reduceLyricRepetition(options: {
  lyrics: string;
  profile: ArtistProfile;
  theme: string;
}): Promise<{ lyrics: string; reduced: boolean }> {
  const report = analyzeOveruse(options.lyrics);
  if (!report.isOverused) {
    return { lyrics: options.lyrics, reduced: false };
  }

  const lineCount = extractRapLines(options.lyrics).length;
  const summary = overuseSummaryForPrompt(report);

  const system = `あなたは日本語ラップの作詞編集者です。
歌詞の意味・テーマ・行数・セクションタグ・韻（行末母音）は維持し、語彙の重複だけを減らしてください。
同じ言葉・同じフレーズの使い回しをやめ、言い換え・比喩・具体描写を増やします。
Hook/サビの意図的な反復は最大2回までに抑える。`;

  const user = [
    `# アーティスト: ${options.profile.name}`,
    `# テーマ: ${options.theme}`,
    `# 問題: ${summary}`,
    "",
    report.words.length > 0
      ? `## 使いすぎ単語\n${report.words.map((w) => `- ${w.term}: ${w.count}回`).join("\n")}`
      : "",
    report.phrases.length > 0
      ? `## 繰り返しフレーズ\n${report.phrases.map((p) => `- 「${p.term}」×${p.count}`).join("\n")}`
      : "",
    report.duplicateLines.length > 0
      ? `## 同文行\n${report.duplicateLines.map((l) => `- ${l}`).join("\n")}`
      : "",
    "",
    "## 修正前",
    options.lyrics,
    "",
    `出力: 修正後の歌詞のみ。ラップ行は正確に ${lineCount} 行（[Verse] 等タグは維持）。`,
    "各行末の韻は変えない。中身の語彙と言い回しだけ多様に。",
  ]
    .filter(Boolean)
    .join("\n");

  const revised = await deepseekChat({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    maxTokens: Math.min(2400, 120 + lineCount * 80),
    thinking: false,
    temperature: 0.72,
  });

  return { lyrics: revised.trim(), reduced: true };
}

export async function maybeReduceRepetition(options: {
  lyrics: string;
  profile: ArtistProfile;
  theme: string;
  enabled?: boolean;
}): Promise<{ lyrics: string; repetitionReduced: boolean }> {
  if (options.enabled === false) {
    return { lyrics: options.lyrics, repetitionReduced: false };
  }

  const result = await reduceLyricRepetition({
    lyrics: options.lyrics,
    profile: options.profile,
    theme: options.theme,
  });

  return {
    lyrics: result.lyrics,
    repetitionReduced: result.reduced,
  };
}
