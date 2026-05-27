/**
 * クライアント向けエラー区分とその表示属性。
 *
 * backend (tRPC) は失敗時に TRPCError を投げる。code + message slug の組で
 * UX 上の区分（再試行可否・表示文）を決める。slug 定数を本ファイルに集約し
 * backend / mobile 双方から参照する。
 *
 * 設計判断は .handoff/handoff-2026-05-27-1627.md の「確定済みの設計判断」参照。
 */

/** クライアントが UX を切り替えるためのエラー区分（5 種）。 */
export type ErrorCode =
  | "NO_TRANSCRIPT"
  | "VIDEO_NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_FAILED"
  | "SERVER_ERROR";

/**
 * backend が投げる TRPCError.message の先頭に置く slug。
 * 区分判別キーとして mobile 側 normalizeError が見る。
 * メッセージ本文（": " 以降）は人間向け補足で、判別には使わない。
 */
export const TRANSCRIPT_UNAVAILABLE_SLUG = "transcript_unavailable";
export const VIDEO_UNAVAILABLE_SLUG = "video_unavailable";
export const SUPADATA_RATE_LIMITED_SLUG = "supadata_rate_limited";
export const SUPADATA_UNEXPECTED_STATUS_SLUG = "supadata_unexpected_status";
export const SUPADATA_UNEXPECTED_SHAPE_SLUG = "supadata_unexpected_shape";
export const TRANSCRIPT_SERVICE_UNAVAILABLE_SLUG = "transcript_service_unavailable";
export const YOUTUBE_OEMBED_FAILED_SLUG = "youtube_oembed_failed";
export const YOUTUBE_OEMBED_UNEXPECTED_SHAPE_SLUG = "youtube_oembed_unexpected_shape";

interface ErrorCodeDisplay {
  /** ユーザーに見せる日本語メッセージ。 */
  displayMessage: string;
  /** 「もう一度試す」ボタンを出してよいか。 */
  retryable: boolean;
}

export const ERROR_CODE_DISPLAY: Record<ErrorCode, ErrorCodeDisplay> = {
  NO_TRANSCRIPT: {
    displayMessage: "この動画には字幕がありません",
    retryable: false,
  },
  VIDEO_NOT_FOUND: {
    displayMessage: "動画が見つからないか非公開です",
    retryable: false,
  },
  RATE_LIMITED: {
    displayMessage: "混み合っています。少し待って再試行してください",
    retryable: true,
  },
  UPSTREAM_FAILED: {
    displayMessage: "外部サービスで一時的なエラーが発生しました",
    retryable: true,
  },
  SERVER_ERROR: {
    displayMessage: "通信エラーが発生しました",
    retryable: true,
  },
};

/**
 * tRPC のエラー（または同形オブジェクト）を ErrorCode に正規化する。
 *
 * 想定入力: `useMutation().error` が返す TRPCClientError。
 *   - `data.code`: TRPC のエラーコード文字列 (例 "NOT_FOUND")
 *   - `message`:   backend で `TRPCError({ message: "slug: ..." })` した本文
 *
 * shared はランタイム非依存ルールのため @trpc/client / @trpc/server に
 * 依存させない。受け側で duck-type 受け取りする。
 */
export interface NormalizableError {
  data?: { code?: string | null } | null;
  message?: string | null;
}

export function normalizeError(err: NormalizableError | null | undefined): ErrorCode {
  if (!err) {
    return "SERVER_ERROR";
  }
  const code = err.data?.code ?? null;
  const message = err.message ?? "";

  if (code === "NOT_FOUND") {
    if (message.startsWith(TRANSCRIPT_UNAVAILABLE_SLUG)) return "NO_TRANSCRIPT";
    if (message.startsWith(VIDEO_UNAVAILABLE_SLUG)) return "VIDEO_NOT_FOUND";
    return "SERVER_ERROR";
  }
  if (code === "TOO_MANY_REQUESTS") return "RATE_LIMITED";
  if (code === "BAD_GATEWAY") return "UPSTREAM_FAILED";

  return "SERVER_ERROR";
}
