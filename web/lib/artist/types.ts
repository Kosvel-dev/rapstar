export type StoredSong = {
  id: number;
  title: string;
  full_title?: string;
  primary_artist: string;
  featured_artists?: string[];
  release_date?: string;
  language?: string;
  lyrics_state?: string;
  url?: string;
  album?: string | null;
  lyrics: string;
};

export type StoredArtistCorpus = {
  fetched_at?: string;
  source?: string;
  artist: {
    id: number;
    name: string;
    url?: string;
    genius_song_count?: number;
    lyrics_complete_count?: number;
  };
  songs: StoredSong[];
};

export type FlowStyleHint = {
  bpmRange: string;
  targetMorasPerBar: number;
  label: string;
  description: string;
};

export type ArtistProfile = {
  slug: string;
  name: string;
  geniusUrl?: string;
  songCount: number;
  lineCount: number;
  flow: {
    averageMorasPerLine: number;
    stdDevMoras: number;
    uniformityScore: number;
    typicalBpmRange: [number, number];
    flowStyles: FlowStyleHint[];
  };
  rhyme: {
    averageEndRhymeScore: number;
    averageInternalRhymeScore: number;
    commonEndVowelTails: { tail: string; count: number }[];
  };
  vocabulary: {
    topWords: { word: string; count: number }[];
    englishTokenRatio: number;
    uniqueWordCount: number;
  };
  delivery: {
    traits: string[];
    adlibPatterns: { pattern: string; count: number }[];
    englishMixLevel: "low" | "medium" | "high";
    punchlineDensity: number;
    styleSummary: string;
  };
  songs: { id: number; title: string; releaseDate?: string; url?: string }[];
  generatedAt: string;
};
