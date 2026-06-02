import fs from "node:fs/promises";
import path from "node:path";
import type { StoredArtistCorpus } from "@/lib/artist/types";
import { getDataRoot } from "@/lib/data/paths";

export async function listArtistSlugs(): Promise<string[]> {
  const dataRoot = getDataRoot();
  const entries = await fs.readdir(dataRoot, { withFileTypes: true });
  const slugs: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const lyricsPath = path.join(dataRoot, entry.name, "lyrics.json");
    try {
      await fs.access(lyricsPath);
      slugs.push(entry.name);
    } catch {
      // skip
    }
  }

  return slugs.sort();
}

export async function loadArtistCorpus(slug: string): Promise<StoredArtistCorpus> {
  const filePath = path.join(getDataRoot(), slug, "lyrics.json");
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as StoredArtistCorpus;
}
