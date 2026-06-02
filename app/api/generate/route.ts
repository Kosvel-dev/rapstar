import { NextResponse } from "next/server";
import { buildArtistProfile } from "@/lib/artist/buildProfile";
import { loadArtistCorpus } from "@/lib/data/loadArtistData";
import { loadRootEnv } from "@/lib/env";
import { generateLyricsInStyle } from "@/lib/llm/generateInStyle";
import { generateFullSongLyrics } from "@/lib/llm/generateFullSong";
import type { SongSectionConfig } from "@/lib/llm/songStructure";
import {
  annotateLyricsWithReading,
  formatLyricsWithReading,
} from "@/lib/reading/annotateLyrics";
import { isThemeValid, parseThemeInput } from "@/lib/llm/themeInput";
import type { LearningModeId } from "@/lib/llm/learningModes";

export async function POST(request: Request) {
  loadRootEnv();

  const body = (await request.json()) as {
    slug?: string;
    mainTheme?: string;
    subTheme?: string;
    theme?: string;
    bpm?: number;
    bars?: 4 | 8 | 16;
    format?: "bars" | "full";
    sections?: SongSectionConfig[];
    referenceLine?: string;
    strongRhyme?: boolean;
    learningMode?: LearningModeId;
  };

  const themeInput = parseThemeInput(body);

  if (!body.slug || !isThemeValid(themeInput)) {
    return NextResponse.json(
      { error: "slug, mainTheme, and subTheme are required" },
      { status: 400 },
    );
  }

  if (body.format === "full" && (!body.sections || body.sections.length === 0)) {
    return NextResponse.json(
      { error: "sections are required for full song format" },
      { status: 400 },
    );
  }

  try {
    const corpus = await loadArtistCorpus(body.slug);
    const profile = await buildArtistProfile(body.slug, corpus);
    const format = body.format ?? "bars";

    const result =
      format === "full"
        ? await generateFullSongLyrics({
            artistProfile: profile,
            mainTheme: themeInput.mainTheme,
            subTheme: themeInput.subTheme,
            bpm: body.bpm,
            sections: body.sections ?? [],
            referenceLine: body.referenceLine,
            strongRhyme: body.strongRhyme !== false,
            learningMode: body.learningMode,
          })
        : await generateLyricsInStyle({
            artistProfile: profile,
            mainTheme: themeInput.mainTheme,
            subTheme: themeInput.subTheme,
            bpm: body.bpm,
            bars: body.bars ?? 8,
            referenceLine: body.referenceLine,
            strongRhyme: body.strongRhyme !== false,
            learningMode: body.learningMode,
          });

    const annotatedLines = await annotateLyricsWithReading(result.lyrics);

    return NextResponse.json({
      lyrics: result.lyrics,
      annotatedLines,
      lyricsWithReading: formatLyricsWithReading(annotatedLines),
      profileName: profile.name,
      rhymeCoverage: result.rhymeCoverage,
      rhymeMetrics: result.rhymeMetrics,
      rhymeRefined: result.rhymeRefined,
      repetitionReduced: result.repetitionReduced,
      format,
      ...(format === "full"
        ? {
            sectionCount: (result as { sectionCount?: number }).sectionCount,
            lineCount: (result as { lineCount?: number }).lineCount,
          }
        : {}),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
