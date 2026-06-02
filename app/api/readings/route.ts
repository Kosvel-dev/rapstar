import { NextResponse } from "next/server";
import {
  annotateLyricsWithReading,
  formatLyricsWithReading,
} from "@/lib/reading/annotateLyrics";

export async function POST(request: Request) {
  const body = (await request.json()) as { lyrics?: string };

  if (!body.lyrics?.trim()) {
    return NextResponse.json({ error: "lyrics is required" }, { status: 400 });
  }

  try {
    const lines = await annotateLyricsWithReading(body.lyrics);
    return NextResponse.json({
      lines,
      formatted: formatLyricsWithReading(lines),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reading failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
