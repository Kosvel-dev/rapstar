export type RhymeWordValidityOptions = {
  queryWord?: string;
  allowedWords?: string[];
};

export function isLikelyInvalidRhymeWord(
  word: string,
  options: RhymeWordValidityOptions = {},
): boolean {
  const w = word.trim();
  if (!w || w.length < 2) return true;
  if (options.queryWord && w === options.queryWord.trim()) return false;
  if (options.allowedWords?.includes(w)) return false;
  if (/^[\d\s]+$/u.test(w)) return true;
  if (!/[\p{L}\p{N}]/u.test(w)) return true;
  if (/^(yo|hey|ah|huh|ok|ayy|yeah)$/iu.test(w)) return true;
  return false;
}
