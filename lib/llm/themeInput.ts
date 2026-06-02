import { MAIN_THEME_CATEGORIES } from "@/lib/llm/lyricCraftGuide";

export type LyricThemeInput = {
  mainTheme: string;
  subTheme: string;
};

export function combineTheme(input: LyricThemeInput): string {
  const main = input.mainTheme.trim();
  const sub = input.subTheme.trim();
  if (main && sub) return `${main} — ${sub}`;
  return sub || main || "";
}

export function parseThemeInput(body: {
  mainTheme?: string;
  subTheme?: string;
  theme?: string;
}): LyricThemeInput {
  if (body.mainTheme?.trim() || body.subTheme?.trim()) {
    return {
      mainTheme: body.mainTheme?.trim() || "成功",
      subTheme: body.subTheme?.trim() || "",
    };
  }
  const legacy = body.theme?.trim() ?? "";
  if (!legacy) {
    return { mainTheme: "成功", subTheme: "" };
  }
  const dash = legacy.match(/^(.+?)\s*[—–-]\s*(.+)$/);
  if (dash) {
    const maybeMain = dash[1].trim();
    if ((MAIN_THEME_CATEGORIES as readonly string[]).includes(maybeMain)) {
      return { mainTheme: maybeMain, subTheme: dash[2].trim() };
    }
  }
  return { mainTheme: "成功", subTheme: legacy };
}

export function isThemeValid(input: LyricThemeInput): boolean {
  return Boolean(input.mainTheme.trim() && input.subTheme.trim());
}
