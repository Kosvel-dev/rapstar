import type OpenAI from "openai";
import { createLLMClient, getLLMModel } from "./client";

type DeepSeekMessage = OpenAI.Chat.Completions.ChatCompletionMessage & {
  reasoning_content?: string | null;
};

export type DeepSeekChatParams = {
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  maxTokens: number;
  /** V4 Pro: 歌詞生成は false 推奨（thinking が token を消費して content が空になりやすい） */
  thinking?: boolean;
  temperature?: number;
  responseFormat?: { type: "json_object" };
};

function isV4Model(model: string): boolean {
  return model.includes("v4");
}

/**
 * DeepSeek V4 API 向け chat/completions 呼び出し。
 * @see https://api-docs.deepseek.com/
 * @see https://api-docs.deepseek.com/guides/thinking_mode
 */
export async function deepseekChat(
  params: DeepSeekChatParams,
): Promise<string> {
  const client = createLLMClient();
  const model = getLLMModel();
  const thinkingEnabled =
    params.thinking ?? process.env.DEEPSEEK_THINKING === "true";

  const requestBody: Record<string, unknown> = {
    model,
    messages: params.messages,
    max_tokens: params.maxTokens,
    stream: false,
  };

  if (params.responseFormat) {
    requestBody.response_format = params.responseFormat;
  }

  // V4: thinking 有効時は temperature 等は無効（送ってもエラーにはならない）
  if (!thinkingEnabled && params.temperature !== undefined) {
    requestBody.temperature = params.temperature;
  }

  if (isV4Model(model)) {
    requestBody.thinking = { type: thinkingEnabled ? "enabled" : "disabled" };
    if (thinkingEnabled) {
      requestBody.reasoning_effort =
        process.env.DEEPSEEK_REASONING_EFFORT ?? "high";
    }
  }

  const response = await client.chat.completions.create(
    requestBody as unknown as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
  );

  const choice = response.choices[0];
  const message = choice?.message as DeepSeekMessage | undefined;
  const content = message?.content?.trim() ?? "";

  if (content) return content;

  const finishReason = choice?.finish_reason;
  const reasoningLen = message?.reasoning_content?.length ?? 0;

  if (reasoningLen > 0) {
    throw new Error(
      `歌詞の生成に失敗しました（Thinking が ${reasoningLen} 文字使われ、本文が空）。` +
        ` DEEPSEEK_THINKING=false または max_tokens を増やしてください。`,
    );
  }

  if (finishReason === "length") {
    throw new Error(
      "歌詞の生成に失敗しました（トークン上限）。max_tokens を増やしてください。",
    );
  }

  throw new Error("歌詞の生成に失敗しました（空のレスポンス）");
}

/** 出力形式ごとの max_tokens */
export function maxTokensForFormat(
  format: "4bars" | "8bars" | "16bars" | "hook" | "punchline",
): number {
  switch (format) {
    case "punchline":
      return 400;
    case "4bars":
      return 600;
    case "8bars":
      return 1000;
    case "16bars":
      return 1500;
    case "hook":
      return 800;
  }
}
