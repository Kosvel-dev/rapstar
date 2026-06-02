import OpenAI from "openai";

export type LLMConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

/**
 * 歌詞生成用 LLM 設定。
 * デフォルトは DeepSeek（OpenAI 互換 API）。
 *
 * 優先順: DEEPSEEK_* → LLM_* → OPENAI_*（後方互換）
 *
 * モデル: deepseek-v4-pro（推奨） / deepseek-v4-flash / deepseek-chat（旧・Flash相当）
 */
export function getLLMConfig(): LLMConfig {
  const apiKey =
    process.env.DEEPSEEK_API_KEY ??
    process.env.LLM_API_KEY ??
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY（または LLM_API_KEY）が設定されていません。歌詞生成に LLM が必要です。",
    );
  }

  const baseURL =
    process.env.DEEPSEEK_BASE_URL ??
    process.env.LLM_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    "https://api.deepseek.com";

  const model =
    process.env.DEEPSEEK_MODEL ??
    process.env.LLM_MODEL ??
    process.env.OPENAI_MODEL ??
    "deepseek-v4-pro";

  return { apiKey, baseURL, model };
}

/** OpenAI SDK で DeepSeek 等の互換 API を呼ぶ */
export function createLLMClient(): OpenAI {
  const { apiKey, baseURL } = getLLMConfig();
  return new OpenAI({ apiKey, baseURL });
}

export function getLLMModel(): string {
  return getLLMConfig().model;
}
