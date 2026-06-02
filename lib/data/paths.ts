import path from "node:path";

/** 歌詞コーパス（リポジトリルート / data） */
export function getDataRoot(): string {
  return path.join(process.cwd(), "data");
}

export function profileCachePath(slug: string): string {
  return path.join(getDataRoot(), slug, "profile.json");
}
