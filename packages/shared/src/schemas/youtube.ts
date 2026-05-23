/**
 * YouTube URL / videoId の共通 Zod schema。
 * backend では入力検証、mobile では送信前の事前チェックに使う。
 */
import { z } from "zod";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** YouTube の videoId（11文字・英数字 + - _） */
export const videoIdSchema = z.string().regex(VIDEO_ID_RE, "Invalid YouTube videoId");

export type VideoId = z.infer<typeof videoIdSchema>;

/**
 * YouTube URL を受け取り videoId に変換する schema。
 * 対応形式:
 *   - https://www.youtube.com/watch?v=XXXXXXXXXXX
 *   - https://m.youtube.com/watch?v=XXXXXXXXXXX
 *   - https://youtu.be/XXXXXXXXXXX
 *   - https://www.youtube.com/shorts/XXXXXXXXXXX
 *   - https://www.youtube.com/embed/XXXXXXXXXXX
 */
export const youtubeUrlSchema = z
  .string()
  .url()
  .transform((url, ctx) => {
    const videoId = extractVideoId(url);
    if (!videoId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a valid YouTube URL",
      });
      return z.NEVER;
    }
    return videoId;
  })
  .pipe(videoIdSchema);

export function extractVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1);
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    const v = parsed.searchParams.get("v");
    if (v && VIDEO_ID_RE.test(v)) return v;

    const match = parsed.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})/);
    return match?.[1] ?? null;
  }

  return null;
}
