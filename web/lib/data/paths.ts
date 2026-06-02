import fs from "node:fs";
import path from "node:path";

/** ローカル（web/）と Vercel（リポジトリルート/data）の両方に対応 */
export function getDataRoot(): string {
  const candidates = [
    path.join(process.cwd(), "..", "data"),
    path.join(process.cwd(), "data"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

export function profileCachePath(slug: string): string {
  return path.join(getDataRoot(), slug, "profile.json");
}
