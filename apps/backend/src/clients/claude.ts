/**
 * Claude API クライアント。要約・翻訳のシステムプロンプトと低レベル呼び出しを定義する。
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
 *
 * 翻訳の SDK 呼び出し本体は services/translation.ts に分離している。ここでは
 * 翻訳プロンプトの素材（SYSTEM プロンプト・version 文字列）だけを公開する。
 */
import Anthropic from "@anthropic-ai/sdk";
import { type SummaryRequest, type SummaryResult, summaryRequestSchema } from "@shari/shared";

export const DEFAULT_MODEL = "claude-opus-4-7";

/**
 * システムプロンプト本体のバージョン。
 * SYSTEM_PROMPT 本文を書き換えたら必ず bump すること（DB の prompt_version で
 * 強制再生成させるため）。
 *
 * v2-translate-then-summarize: 字幕 → 日本語訳 → 要約の 2 段構成に切替。
 * summarize の入力 transcriptText は翻訳済みテキストになる（procedure 側で挿入）。
 * SYSTEM_PROMPT 本文は変更していないが、入力意味が変わるため bump する。
 * 既存 summaries キャッシュは (video_id, language, prompt_version) で自然に miss し、
 * 新方式で再生成される（データ移行不要）。
 */
export const PROMPT_TEMPLATE_VERSION = "v2-translate-then-summarize";

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

  const finalMessage = await stream.finalMessage();

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

// ============================================================
// 翻訳プロンプト
// ============================================================

/**
 * 翻訳プロンプトテンプレ本体のバージョン。
 * TRANSLATION_SYSTEM_PROMPT 本文を書き換えたら bump する。
 * translations テーブルの PK には含めないため（docs/data-model.md §6）、
 * 破壊的にプロンプトを変えるときは行を明示的に削除する運用。
 */
export const TRANSLATION_PROMPT_TEMPLATE_VERSION = "v1";

/**
 * 翻訳の prompt_version 文字列。translations テーブルの監査メタとして書き込む
 * （cache key ではなく traceability 用途）。
 *
 * `t-` プレフィックスで要約の `buildPromptVersion` 出力と区別する。
 * 別テーブルなので衝突はしないが、ログ・監査時に混在しても見分けがつくため。
 */
export function buildTranslationPromptVersion(model: string = DEFAULT_MODEL): string {
  return `t-${TRANSLATION_PROMPT_TEMPLATE_VERSION}-${model}`;
}

/**
 * 翻訳用 system プロンプト。
 * 要約用と分離している理由:
 * - 翻訳は「意味保存・構造保存」が最優先で、要約のような構成指示は邪魔になる
 * - cache_control を別物として効かせたい（要約と翻訳で別の cache breakpoint）
 */
export const TRANSLATION_SYSTEM_PROMPT = `あなたはソフトウェアエンジニア向けの技術翻訳者です。YouTube 動画の字幕を、後段の要約処理が読みやすいように指定言語へ翻訳します。

# 翻訳方針

- 意味と論理構造を保存する。意訳しすぎず、原文の主張・順序・因果関係をそのまま運ぶ。
- 技術用語・固有名詞・OSS 名・製品名・コード片は原語のまま残す（例: "embedding", "garbage collector", "Rust", "PostgreSQL"）。日本語に置き換えると意味が痩せるため。
- 字幕特有のノイズ（filler words: "you know", "like", "um"、繰り返し、明らかな書き起こしミス）は読みやすさのために整える。ただし内容自体は改変しない。
- 段落単位で自然な文章にまとめる。元の字幕の改行位置やタイムスタンプ単位の細切れに引きずられない。
- 推測・要約・補足を加えない。後段の要約 LLM がそれをやる。あなたの仕事は「言語を変える」だけ。
- 出力は翻訳本文のみ。「以下に翻訳します」のような枕詞・前置き・締めの挨拶は不要。`;

/**
 * 翻訳の user プロンプト本体を組み立てる。
 * 翻訳の SDK 呼び出し本体（services/translation.ts）から参照される。
 */
export function buildTranslationUserPrompt(input: {
  videoTitle: string;
  channelName: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
}): string {
  return [
    `# 動画`,
    `タイトル: ${input.videoTitle}`,
    `チャンネル: ${input.channelName}`,
    `元言語: ${input.sourceLanguage}`,
    `訳出言語: ${input.targetLanguage}`,
    ``,
    `# 字幕本文（${input.sourceLanguage}）`,
    ``,
    input.sourceText,
  ].join("\n");
}
