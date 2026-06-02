import { NextResponse } from "next/server";
import { listArtistSlugs, loadArtistCorpus } from "@/lib/data/loadArtistData";

export async function GET() {
  const slugs = await listArtistSlugs();
  const artists = await Promise.all(
    slugs.map(async (slug) => {
      const corpus = await loadArtistCorpus(slug);
      return {
        slug,
        name: corpus.artist.name,
        songCount: corpus.songs.filter((s) => s.lyrics?.trim()).length,
        url: corpus.artist.url,
      };
    }),
  );

  return NextResponse.json({ artists });
}
