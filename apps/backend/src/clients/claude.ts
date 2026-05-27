/**
 * Claude API による技術動画字幕の要約。
 *
 * 設計メモ:
 * - Anthropic 公式 SDK (`@anthropic-ai/sdk`) を使用。fetch ベースで Workers 互換。
 * - デフォルトモデルは Claude Opus 4.7。コスト調整したい場合のみ呼び出し側で
 *   `claude-sonnet-4-6` / `claude-haiku-4-5` を明示指定する。
 * - 長い字幕 + adaptive thinking のため streaming 必須。`.finalMessage()` で待つ。
 * - システムプロンプトに cache_control を付与。同じテンプレートでの 2 回目以降の
 *   呼び出しは入力トークンの大半が cache_read（〜10% コスト）になる。
 * - thinking content は default の "omitted"（UI に出さないため）。
 * - Opus 4.7 では temperature / top_p / top_k / budget_tokens は使用不可（400）。
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  LLM_OVERLOADED_SLUG,
  type SummaryRequest,
  type SummaryResult,
  summaryRequestSchema,
} from "@shari/shared";
import { TRPCError } from "@trpc/server";

export const DEFAULT_MODEL = "claude-opus-4-7";

/**
 * システムプロンプト本体のバージョン。
 * SYSTEM_PROMPT 本文を書き換えたら必ず bump すること（DB の prompt_version で
 * 強制再生成させるため）。
 */
export const PROMPT_TEMPLATE_VERSION = "v1";

/**
 * (template, model) の組から prompt_version 文字列を作る。
 * summaries テーブルの (video_id, language, prompt_version) unique 制約で
 * キャッシュキーとして使うため、procedure 側からも参照可能にする。
 */
export function buildPromptVersion(model: string = DEFAULT_MODEL): string {
  return `${PROMPT_TEMPLATE_VERSION}-${model}`;
}

const SYSTEM_PROMPT = `あなたは日本のソフトウェアエンジニアに向けて、YouTube 技術動画の字幕を日本語で要約するアシスタントです。

# 要約方針

- 対象読者: 中級以上の日本人エンジニア。技術用語は無理に和訳せず英語のまま使ってよい（例: "embedding", "rate limit", "garbage collector"）。固有名詞・製品名・OSS 名は原語を維持。
- 構成: 以下のセクションを Markdown の見出しで含める。
  - \`## 一行サマリ\`: 動画全体を 1 文（〜80 字）で要約。
  - \`## 主な内容\`: 3〜7 個の箇条書きで、登場した重要トピック・主張・結論を順序立てて列挙。
  - \`## 技術的ハイライト\`: エンジニアが特に押さえるべきアーキテクチャ・コード例・ベンチマーク・トレードオフ等。該当する内容がなければ「該当なし」と書く。
  - \`## 補足\`: 必要に応じて前提知識・関連リンクの示唆・注意点。不要なら省略可。
- スタイル: 簡潔・断定的。「〜と話している」のような伝聞表現は避け、内容を直接書く。冗長な前置きや結びの挨拶は不要。
- 字幕に明示されていない事実は推測・捏造しない。曖昧な箇所はその旨を明記する。

# 出力

Markdown のみを出力する。「以下に要約します」のような枕詞は付けない。`;

export interface SummarizeOptions {
  /** 使用する Claude モデル。デフォルト: claude-opus-4-7 */
  model?: string;
}

/**
 * Anthropic API のレスポンスが「過負荷」起因かを判定する。
 *   - HTTP 529 を返すケース
 *   - body に `{"error": {"type": "overloaded_error"}}` を含むケース
 * SDK のクラス比較は bundle 越境で instanceof が滑ることがあるため duck-type で見る。
 */
function isOverloadedError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: unknown; error?: { error?: { type?: unknown } } };
  if (e.status === 529) return true;
  if (e.error?.error?.type === "overloaded_error") return true;
  return false;
}

export async function summarizeTranscript(
  env: { ANTHROPIC_API_KEY: string },
  rawRequest: SummaryRequest,
  options: SummarizeOptions = {},
): Promise<SummaryResult> {
  const request = summaryRequestSchema.parse(rawRequest);
  const model = options.model ?? DEFAULT_MODEL;

  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const userPrompt = [
    `# 動画`,
    `タイトル: ${request.videoTitle}`,
    `チャンネル: ${request.channelName}`,
    `字幕言語: ${request.transcriptLanguage}`,
    `出力言語: ${request.language}`,
    ``,
    `# 字幕`,
    ``,
    request.transcriptText,
  ].join("\n");

  const stream = client.messages.stream({
    model,
    max_tokens: 32000,
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  let finalMessage: Anthropic.Message;
  try {
    finalMessage = await stream.finalMessage();
  } catch (err) {
    // Anthropic 側が一時的に過負荷の場合は HTTP 529 + body.type="overloaded_error"。
    // INTERNAL_SERVER_ERROR のまま再 throw すると mobile では "通信エラー" に潰れて
    // 「アプリ側のバグ」と誤解されるため、BAD_GATEWAY (= UPSTREAM_FAILED) に変換して
    // 「外部サービスで一時的なエラー」として表示させる。
    if (isOverloadedError(err)) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: `${LLM_OVERLOADED_SLUG}: Anthropic API is currently overloaded`,
        cause: err,
      });
    }
    throw err;
  }

  const summaryMd = finalMessage.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!summaryMd) {
    throw new Error(`Claude が空の要約を返しました (stop_reason=${finalMessage.stop_reason})`);
  }

  const usage = finalMessage.usage;
  // input_tokens は uncached の残りのみなので、cache 経由を合算して総入力量にする。
  const inputTokens =
    usage.input_tokens +
    (usage.cache_creation_input_tokens ?? 0) +
    (usage.cache_read_input_tokens ?? 0);

  return {
    summaryMd,
    model,
    promptVersion: buildPromptVersion(model),
    inputTokens,
    outputTokens: usage.output_tokens,
  };
}
