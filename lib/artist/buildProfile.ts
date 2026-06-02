import { analyzeLyrics } from "@/lib/analysis/analyzeLyrics";
import { bpmFlowInstruction, targetMorasPerLine } from "@/lib/analysis/bpm";
import { vowelTail } from "@/lib/analysis/kana";
import { extractRapLines } from "@/lib/artist/cleanLyrics";
import {
  analyzeDeliveryFromCorpus,
  topWordsFromCorpus,
} from "@/lib/artist/deliveryStyle";
import type { ArtistProfile, StoredArtistCorpus } from "@/lib/artist/types";

function flowStylesForArtist(avgMoras: number): ArtistProfile["flow"]["flowStyles"] {
  const bpms = [80, 95, 110, 128, 145];
  return bpms.map((bpm) => {
    const target = targetMorasPerLine(bpm);
    const diff = Math.abs(target - avgMoras);
    let label = "標準フロー";
    if (diff <= 2) label = "相性◎";
    else if (target > avgMoras + 3) label = "速口・詰め気味";
    else if (target < avgMoras - 3) label = "ゆったり・伸ばし向き";

    return {
      bpmRange: `${bpm}`,
      targetMorasPerBar: target,
      label,
      description: bpmFlowInstruction(bpm),
    };
  });
}

export async function buildArtistProfile(
  slug: string,
  corpus: StoredArtistCorpus,
): Promise<ArtistProfile> {
  const songsWithLyrics = corpus.songs.filter((s) => s.lyrics?.trim());
  const allRapText = songsWithLyrics
    .map((s) => extractRapLines(s.lyrics).join("\n"))
    .join("\n");

  let totalLines = 0;
  let moraSum = 0;
  let endRhymeSum = 0;
  let internalRhymeSum = 0;
  let analyzedSongs = 0;
  const vowelTailCounts = new Map<string, number>();

  const morasPerLineAll: number[] = [];

  for (const song of songsWithLyrics) {
    const lines = extractRapLines(song.lyrics);
    if (lines.length < 2) continue;

    const analysis = await analyzeLyrics(lines.join("\n"));
    analyzedSongs++;
    totalLines += analysis.lines.length;
    moraSum += analysis.flow.averageMoras * analysis.lines.length;
    endRhymeSum += analysis.density.endRhyme;
    internalRhymeSum += analysis.density.internalRhyme;
    morasPerLineAll.push(...analysis.flow.morasPerLine);

    for (const line of analysis.lines) {
      const tail = vowelTail(line.endVowels, 2);
      if (tail.length >= 2) {
        vowelTailCounts.set(tail, (vowelTailCounts.get(tail) ?? 0) + 1);
      }
    }
  }

  const avgMoras =
    totalLines > 0 ? Math.round((moraSum / totalLines) * 10) / 10 : 8;

  const avg =
    morasPerLineAll.length > 0
      ? morasPerLineAll.reduce((a, b) => a + b, 0) / morasPerLineAll.length
      : avgMoras;
  const variance =
    morasPerLineAll.length > 0
      ? morasPerLineAll.reduce((s, v) => s + (v - avg) ** 2, 0) /
        morasPerLineAll.length
      : 0;
  const stdDevMoras = Math.round(Math.sqrt(variance) * 10) / 10;
  const uniformityScore = Math.max(
    0,
    Math.min(100, Math.round(100 - stdDevMoras * 12)),
  );

  const delivery = analyzeDeliveryFromCorpus(allRapText);
  const topWords = topWordsFromCorpus(allRapText);

  const commonEndVowelTails = [...vowelTailCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tail, count]) => ({ tail, count }));

  return {
    slug,
    name: corpus.artist.name,
    geniusUrl: corpus.artist.url,
    songCount: songsWithLyrics.length,
    lineCount: totalLines,
    flow: {
      averageMorasPerLine: avgMoras,
      stdDevMoras,
      uniformityScore,
      typicalBpmRange: [90, 130],
      flowStyles: flowStylesForArtist(avgMoras),
    },
    rhyme: {
      averageEndRhymeScore:
        analyzedSongs > 0 ? Math.round(endRhymeSum / analyzedSongs) : 0,
      averageInternalRhymeScore:
        analyzedSongs > 0 ? Math.round(internalRhymeSum / analyzedSongs) : 0,
      commonEndVowelTails,
    },
    vocabulary: {
      topWords,
      englishTokenRatio: delivery.englishTokenRatio,
      uniqueWordCount: topWords.length,
    },
    delivery: {
      traits: delivery.traits,
      adlibPatterns: delivery.adlibPatterns,
      englishMixLevel: delivery.englishMixLevel,
      punchlineDensity: delivery.punchlineDensity,
      styleSummary: delivery.styleSummary,
    },
    songs: songsWithLyrics.map((s) => ({
      id: s.id,
      title: s.title,
      releaseDate: s.release_date,
      url: s.url,
    })),
    generatedAt: new Date().toISOString(),
  };
}
