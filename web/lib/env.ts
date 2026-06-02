import fs from "node:fs";
import path from "node:path";

/** rapstar ルートの .env を web から読み込む（Vercel ではダッシュボードの環境変数を使用） */
export function loadRootEnv(): void {
  if (process.env.VERCEL) return;
  const envPath = path.join(process.cwd(), "..", ".env");
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}
