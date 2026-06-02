import { NextResponse } from "next/server";
import { buildArtistProfile } from "@/lib/artist/buildProfile";
import { loadArtistCorpus } from "@/lib/data/loadArtistData";
import { loadRootEnv } from "@/lib/env";
import { generateLyricsInStyle } from "@/lib/llm/generateInStyle";
import { generateFullSongLyrics } from "@/lib/llm/generateFullSong";
import type { SongSectionConfig } from "@/lib/llm/songStructure";

export async function POST(request: Request) {
  loadRootEnv();

  const body = (await request.json()) as {
    slug?: string;
    theme?: string;
    bpm?: number;
    bars?: 4 | 8 | 16;
    format?: "bars" | "full";
    sections?: SongSectionConfig[];
    referenceLine?: string;
    strongRhyme?: boolean;
  };

  if (!body.slug || !body.theme?.trim()) {
    return NextResponse.json(
      { error: "slug and theme are required" },
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
            theme: body.theme.trim(),
            bpm: body.bpm,
            sections: body.sections ?? [],
            referenceLine: body.referenceLine,
            strongRhyme: body.strongRhyme !== false,
          })
        : await generateLyricsInStyle({
            artistProfile: profile,
            theme: body.theme.trim(),
            bpm: body.bpm,
            bars: body.bars ?? 8,
            referenceLine: body.referenceLine,
            strongRhyme: body.strongRhyme !== false,
          });

    return NextResponse.json({
      lyrics: result.lyrics,
      profileName: profile.name,
      rhymeCoverage: result.rhymeCoverage,
      rhymeRefined: result.rhymeRefined,
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
