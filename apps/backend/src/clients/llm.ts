/**
 * LLM クライアント抽象化。
 *
 * 設計の意図:
 *   - shari の MVP は Claude API で字幕要約をする (clients/claude.ts)
 *   - Phase 2: Gemini API に切り替えて品質 / コストを比較できるようにする
 *   - Phase 3 (architecture.md 参照): Gemini が動画を直接処理できる性能・速度になれば
 *     transcript 取得自体を bypass して Gemini に YouTube URL を直渡しする方針もありえる
 *
 *   そのため、要約処理を「SummaryRequest を受けて SummaryResult を返す」契約に揃え、
 *   LlmClient を実装するクラスを差し替えるだけで切替可能な構造にする。
 *
 * 切替方法:
 *   env.LLM_PROVIDER で "claude" / "gemini" を選ぶ。デフォルトは "claude"。
 *   Gemini は Phase 2 で実装するため、現状は throw する。
 */
import type { SummaryRequest, SummaryResult } from "@shari/shared";
import { DEFAULT_MODEL, buildPromptVersion, summarizeTranscript } from "./claude.js";

export interface LlmClient {
  /**
   * 現在の LLM + プロンプトテンプレートを識別する文字列。
   * summaries テーブルの prompt_version 列のキャッシュキーとして使う。
   * モデル切替・プロンプト書き換え時は値が変わり、自動的に再生成される。
   */
  readonly promptVersion: string;

  /**
   * 字幕本文を受け取り、Markdown 形式の要約を返す。
   * SummaryRequest / SummaryResult は @shari/shared の Zod スキーマ駆動の型。
   */
  summarize(request: SummaryRequest): Promise<SummaryResult>;
}

class ClaudeClient implements LlmClient {
  readonly promptVersion: string;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
  ) {
    this.promptVersion = buildPromptVersion(model);
  }

  summarize(request: SummaryRequest): Promise<SummaryResult> {
    return summarizeTranscript({ ANTHROPIC_API_KEY: this.apiKey }, request, {
      model: this.model,
    });
  }
}

/**
 * env.LLM_PROVIDER に応じて LlmClient を生成する。
 * 未設定は "claude" と同じ扱い。
 */
export function createLlmClient(env: {
  LLM_PROVIDER?: string;
  ANTHROPIC_API_KEY: string;
}): LlmClient {
  const provider = (env.LLM_PROVIDER ?? "claude").toLowerCase();
  switch (provider) {
    case "":
    case "claude":
      return new ClaudeClient(env.ANTHROPIC_API_KEY);
    case "gemini":
      // Phase 2 で実装予定。docs/architecture.md の Phase 2 セクション参照。
      throw new Error(
        "LLM_PROVIDER=gemini はまだ未実装です。Phase 2 で GeminiClient を追加してください。",
      );
    default:
      throw new Error(`未知の LLM_PROVIDER: ${provider}`);
  }
}
