/** kuromoji 読み解決を使うか（Vercel サーバー側。デフォルト ON） */
export function isKuromojiEnabled(): boolean {
  const flag = process.env.READING_USE_KUROMOJI?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return true;
}
