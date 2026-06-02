import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { buildArtistProfile } from "@/lib/artist/buildProfile";
import { loadArtistCorpus } from "@/lib/data/loadArtistData";
import { profileCachePath } from "@/lib/data/paths";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { slug } = await params;

  try {
    const cachePath = profileCachePath(slug);
    try {
      const cached = await fs.readFile(cachePath, "utf-8");
      const profile = JSON.parse(cached);
      return NextResponse.json({ profile, cached: true });
    } catch {
      // build fresh
    }

    const corpus = await loadArtistCorpus(slug);
    const profile = await buildArtistProfile(slug, corpus);
    await fs.writeFile(cachePath, JSON.stringify(profile, null, 2) + "\n", "utf-8");

    return NextResponse.json({ profile, cached: false });
  } catch {
    return NextResponse.json({ error: "Artist not found" }, { status: 404 });
  }
}
