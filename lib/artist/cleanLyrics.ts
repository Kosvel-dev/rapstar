const SECTION_HEADER = /^\[[^\]]+\]$/;
const GENIUS_TITLE = /^.+「.+」歌詞$/;

/** Genius 歌詞からセクション見出し・タイトル行を除いたラップ行だけ抽出 */
export function extractRapLines(lyrics: string): string[] {
  return lyrics
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (SECTION_HEADER.test(line)) return false;
      if (GENIUS_TITLE.test(line)) return false;
      if (/^embed$/i.test(line)) return false;
      return true;
    });
}
