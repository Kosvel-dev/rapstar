import type { ArtistProfile } from "@/lib/artist/types";
import { beatGenreLabel } from "@/lib/ui/labels";

export type BeatRecommendation = {
  title: string;
  searchQuery: string;
  youtubeSearchUrl: string;
  suggestedBpm: number;
  genre: string;
  reason: string;
  /** embed 用（YouTube Data API 取得時のみ） */
  videoId?: string;
  embedUrl?: string;
};

type ArtistBeatStyle = {
  genres: string[];
  defaultBpm: number;
  keywords: string[];
};

const ARTIST_BEAT_STYLES: Record<string, ArtistBeatStyle> = {
  "masato-hayashi": {
    genres: ["japanese hip hop type beat", "boom bap type beat"],
    defaultBpm: 105,
    keywords: ["成り上がり", "ストリート", "90s"],
  },
  "pxrge-trxxxper": {
    genres: ["drill type beat", "hard trap type beat", "dark trap instrumental"],
    defaultBpm: 140,
    keywords: ["drill", "aggressive", "808"],
  },
};

function youtubeSearchUrl(query: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function recommendBeats(
  slug: string,
  profile: ArtistProfile | null,
  bpm: number,
): BeatRecommendation[] {
  const style = ARTIST_BEAT_STYLES[slug] ?? {
    genres: ["free type beat"],
    defaultBpm: bpm,
    keywords: ["hip hop"],
  };

  const targetBpm = bpm || style.defaultBpm;
  const avgMoras = profile?.flow.averageMorasPerLine ?? 8;

  return style.genres.flatMap((genre, i) => {
    const queries = [
      `free ${genre} ${targetBpm} bpm no tags`,
      `${genre} ${targetBpm} bpm ${style.keywords[0] ?? "free"}`,
    ];

    const genreJa = beatGenreLabel(genre);
    return queries.map((q, qi) => ({
      title: `${genreJa} · ${targetBpm}BPM${qi > 0 ? "（別案）" : ""}`,
      searchQuery: q,
      youtubeSearchUrl: youtubeSearchUrl(q),
      suggestedBpm: targetBpm,
      genre,
      reason:
        i === 0
          ? `${profile?.name ?? "アーティスト"}向け — 1行あたり約${avgMoras}モーラ`
          : "別テイストの候補",
    }));
  }).slice(0, 4);
}

export async function searchYouTubeBeats(
  query: string,
  maxResults = 3,
): Promise<BeatRecommendation[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const url = new URL("https://www.googleapis.com/youtube/v3/search");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("maxResults", String(maxResults));
  url.searchParams.set("key", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) return [];

  const data = (await res.json()) as {
    items?: { id: { videoId: string }; snippet: { title: string } }[];
  };

  return (data.items ?? []).map((item) => ({
    title: item.snippet.title,
    searchQuery: query,
    youtubeSearchUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    suggestedBpm: 0,
    genre: "youtube",
    reason: "YouTube API 検索結果",
    videoId: item.id.videoId,
    embedUrl: `https://www.youtube.com/embed/${item.id.videoId}`,
  }));
}
