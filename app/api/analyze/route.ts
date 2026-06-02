import { NextResponse } from "next/server";
import { analyzeLyrics } from "@/lib/analysis/analyzeLyrics";
import { analyzeDeliveryGuide } from "@/lib/analysis/deliveryGuide";
import {
  buildRhymeGroups,
  summarizeRhymeCoverage,
} from "@/lib/analysis/rhymeGroups";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    lyrics?: string;
    bpm?: number;
    beatsPerBar?: number;
  };

  if (!body.lyrics?.trim()) {
    return NextResponse.json({ error: "lyrics is required" }, { status: 400 });
  }

  const analysis = await analyzeLyrics(body.lyrics, {
    bpm: body.bpm,
    beatsPerBar: body.beatsPerBar ?? 4,
  });

  const rhymeGroups = buildRhymeGroups(analysis.lines);
  const rhymeSummary = summarizeRhymeCoverage(analysis.lines, rhymeGroups);
  const delivery = analyzeDeliveryGuide(analysis.lines, body.lyrics);

  return NextResponse.json({
    analysis,
    rhymeGroups,
    rhymeSummary,
    delivery,
  });
}
