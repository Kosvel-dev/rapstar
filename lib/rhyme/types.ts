export type RhymeSource = "nwnwn" | "kujirahand" | "local";

export type RhymeCandidate = {
  word: string;
  reading?: string;
  vowels?: string;
  score?: number;
  source: RhymeSource;
  inputReading?: string;
  inputVowels?: string;
};
