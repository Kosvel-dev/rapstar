export type RhymeSource = "nwnwn";

export type RhymeCandidate = {
  word: string;
  reading?: string;
  vowels?: string;
  score?: number;
  source: RhymeSource;
  inputReading?: string;
  inputVowels?: string;
};
