/**
 * Transcript Provider 抽象化。
 *
 * 経緯:
 *   YouTube が 2026 年に PoT (Proof of Origin Token) を強制し、Workers の fetch だけで
 *   字幕を取る経路 (Innertube / HTML scrape) は全滅。当面は外部の transcript SaaS を
 *   経由して字幕を取得する。MVP では Supadata を採用。
 *
 *   将来 Provider を差し替えやすいよう、provider 実装を本ファイルに集約し、
 *   factory で env から選ぶ。候補:
 *     - "supadata"  (MVP): Supadata Transcript API
 *     - "self-host" (将来): 自前 Node.js プロキシ (Fly.io / Railway) + youtubei.js
 *     - "whisper"   (将来): 動画 audio 抽出 + Whisper fallback
 */
import type { TranscriptOutput, TranscriptSegment } from "@shari/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

export interface TranscriptProvider {
  /** videoId を受け取り字幕の segments + 言語を返す。失敗時は TRPCError を投げる。 */
  fetch(videoId: string): Promise<TranscriptOutput>;
}

/**
 * Supadata Transcript API のレスポンス schema。
 * https://supadata.ai/youtube-transcript-api
 *
 * 受信形:
 *   {
 *     "lang": "en",
 *     "content": [
 *       { "text": "...", "offset": 0, "duration": 14650, "lang": "en" }
 *     ]
 *   }
 *
 * offset / duration はミリ秒。@shari/shared の TranscriptSegment は秒数なので
 * 1000 で割って変換する。
 */
const supadataSegmentSchema = z.object({
  text: z.string(),
  offset: z.number().nonnegative(),
  duration: z.number().nonnegative(),
  lang: z.string().optional(),
});

const supadataResponseSchema = z.object({
  lang: z.string().min(1),
  content: z.array(supadataSegmentSchema),
});

class SupadataProvider implements TranscriptProvider {
  constructor(private readonly apiKey: string) {}

  async fetch(videoId: string): Promise<TranscriptOutput> {
    const url = new URL("https://api.supadata.ai/v1/transcript");
    url.searchParams.set("url", `https://www.youtube.com/watch?v=${videoId}`);

    const res = await fetch(url.toString(), {
      headers: {
        "x-api-key": this.apiKey,
      },
    });

    if (res.status === 404) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "transcript_unavailable: 動画に字幕がありません",
      });
    }
    if (res.status === 401 || res.status === 403) {
      // API キー不正 / 権限不足。利用者には汎用エラーを返しつつ運用ログに残す。
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `supadata_auth_failed: ${res.status}`,
      });
    }
    if (res.status === 429) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "supadata_rate_limited",
      });
    }
    if (!res.ok) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: `supadata_unexpected_status: ${res.status}`,
      });
    }

    const json: unknown = await res.json();
    const parsed = supadataResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "supadata_unexpected_shape",
      });
    }

    const segments: TranscriptSegment[] = parsed.data.content
      .map((s) => ({
        start: s.offset / 1000,
        dur: s.duration / 1000,
        text: s.text.trim(),
      }))
      .filter((s) => s.text.length > 0);

    if (segments.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "transcript_unavailable: 字幕が空でした",
      });
    }

    const textLength = segments.reduce((acc, s) => acc + s.text.length, 0);

    return {
      language: parsed.data.lang,
      segments,
      textLength,
    };
  }
}

/**
 * env.TRANSCRIPT_PROVIDER に応じて provider を生成する。
 * 未設定は "supadata"。
 */
export function createTranscriptProvider(env: {
  TRANSCRIPT_PROVIDER?: string;
  SUPADATA_API_KEY?: string;
}): TranscriptProvider {
  const provider = (env.TRANSCRIPT_PROVIDER ?? "supadata").toLowerCase();
  switch (provider) {
    case "":
    case "supadata": {
      if (!env.SUPADATA_API_KEY) {
        throw new Error("TRANSCRIPT_PROVIDER=supadata の場合は SUPADATA_API_KEY が必須です");
      }
      return new SupadataProvider(env.SUPADATA_API_KEY);
    }
    default:
      throw new Error(`未知の TRANSCRIPT_PROVIDER: ${provider}`);
  }
}
