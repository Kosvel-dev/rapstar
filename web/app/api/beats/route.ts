import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import {
  recommendBeats,
  searchYouTubeBeats,
} from "@/lib/beats/recommendBeats";
import type { ArtistProfile } from "@/lib/artist/types";
import { profileCachePath } from "@/lib/data/paths";
import { loadRootEnv } from "@/lib/env";

export async function GET(request: Request) {
  loadRootEnv();

  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug") ?? "masato-hayashi";
  const bpm = Number(searchParams.get("bpm") ?? "110");

  let profile: ArtistProfile | null = null;
  try {
    const cachePath = profileCachePath(slug);
    const raw = await fs.readFile(cachePath, "utf-8");
    profile = JSON.parse(raw) as ArtistProfile;
  } catch {
    // optional
  }

  const recommendations = recommendBeats(slug, profile, bpm);

  let embeddable = recommendations;
  if (process.env.YOUTUBE_API_KEY && recommendations[0]) {
    const yt = await searchYouTubeBeats(recommendations[0].searchQuery, 3);
    if (yt.length > 0) {
      embeddable = [...yt, ...recommendations];
    }
  }

  return NextResponse.json({
    recommendations: embeddable,
    hasYoutubeApi: Boolean(process.env.YOUTUBE_API_KEY),
  });
}
