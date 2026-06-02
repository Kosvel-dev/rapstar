/**
 * 全アーティストの profile.json を事前生成する。
 * Usage: npx tsx scripts/build-profiles.ts [slug ...]
 */
import fs from "node:fs/promises";
import { buildArtistProfile } from "../lib/artist/buildProfile";
import { loadArtistCorpus, listArtistSlugs } from "../lib/data/loadArtistData";
import { profileCachePath } from "../lib/data/paths";

async function main() {
  const args = process.argv.slice(2);
  const slugs = args.length > 0 ? args : await listArtistSlugs();

  for (const slug of slugs) {
    const outPath = profileCachePath(slug);
    process.stdout.write(`${slug} ... `);
    try {
      const corpus = await loadArtistCorpus(slug);
      const profile = await buildArtistProfile(slug, corpus);
      await fs.writeFile(outPath, JSON.stringify(profile, null, 2) + "\n", "utf-8");
      console.log(`ok (${profile.songCount} songs, ${profile.lineCount} lines)`);
    } catch (err) {
      console.log("FAILED");
      console.error(err);
      process.exitCode = 1;
    }
  }
}

main();
