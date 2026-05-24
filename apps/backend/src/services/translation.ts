/**
 * Claude による字幕翻訳の本体。
 *
 * 設計メモ:
 * - 要約と同じ Anthropic SDK + streaming パターン。翻訳プロンプトの素材
 *   （TRANSLATION_SYSTEM_PROMPT / buildTranslationUserPrompt / version 文字列）は
 *   clients/claude.ts に分離している。ここは「Claude を叩いて Zod-validate された
 *   結果を返す」だけに集中する。
 * - 出力はプレーンテキスト（Markdown ではない）。後段の要約が読みやすいよう、
 *   段落整形の方針は system プロンプトに記述済み。
 * - thinking content は default の "omitted"（UI に出さないため）。
 * - DB 書き込み（translations テーブル）と source==target スキップは router 側で
 *   行う。summary 側と同じ層構成（clients = SDK、router = DB キャッシュ管理）。
 */
import Anthropic from "@anthropic-ai/sdk";
import { type TranslateRequest, type TranslateResult, translateRequestSchema } from "@shari/shared";
import {
  DEFAULT_MODEL,
  TRANSLATION_SYSTEM_PROMPT,
  buildTranslationPromptVersion,
  buildTranslationUserPrompt,
} from "../clients/claude.js";

export interface TranslateOptions {
  /** 使用する Claude モデル。デフォルト: claude-opus-4-7 */
  model?: string;
}

export async function translateTranscript(
  env: { ANTHROPIC_API_KEY: string },
  rawRequest: TranslateRequest,
  options: TranslateOptions = {},
): Promise<TranslateResult> {
  const request = translateRequestSchema.parse(rawRequest);
  const model = options.model ?? DEFAULT_MODEL;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const userPrompt = buildTranslationUserPrompt({
    videoTitle: request.videoTitle,
    channelName: request.channelName,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    sourceText: request.sourceText,
  });

  const stream = client.messages.stream({
    model,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: [
      {
        type: "text",
        text: TRANSLATION_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const finalMessage = await stream.finalMessage();

  const translatedText = finalMessage.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!translatedText) {
    throw new Error(`Claude が空の翻訳を返しました (stop_reason=${finalMessage.stop_reason})`);
  }

  const usage = finalMessage.usage;
  const inputTokens =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0);

  return {
    translatedText,
    sourceLanguage: request.sourceLanguage,
    targetLanguage: request.targetLanguage,
    model,
    promptVersion: buildTranslationPromptVersion(model),
    inputTokens,
    outputTokens: usage.output_tokens,
  };
}
