/**
 * YouTube 字幕 + メタデータ取得サービス（Workers 互換・fetch のみ使用）。
 *
 * 動作原理:
 *   1. https://www.youtube.com/watch?v=<id> を fetch
 *   2. HTML から "videoDetails":{...} JSON ブロックを balanced-bracket で抽出
 *      → タイトル・チャンネル名・チャンネルID・長さ秒を取り出す
 *   3. HTML に埋め込まれた "captionTracks" JSON 配列を正規表現で抽出
 *   4. ja > en > その他 の優先度で字幕トラックを 1 つ選ぶ
 *   5. trackUrl から字幕 XML を fetch
 *   6. <text start="..." dur="..."> ... </text> を正規表現でパース（DOMParser は Workers 非対応）
 *
 * 注意:
 *   - YouTube は IP / User-Agent ベースで時々ブロックを掛けるため、ブラウザ風 UA を付ける
 *   - YouTube HTML は不定期に変わる。captionTracks / videoDetails の位置や形式が動いたら更新が必要
 */
import type { TranscriptOutput, TranscriptSegment } from "@shari/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const captionTrackSchema = z.object({
  baseUrl: z.string().url(),
  languageCode: z.string().min(1),
});
const captionTracksSchema = z.array(captionTrackSchema);

const videoDetailsSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
  channelId: z.string().optional(),
  lengthSeconds: z.string().optional(),
});

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  "Accept-Language": "ja,en;q=0.9",
} as const;

export interface YoutubeMetadata {
  videoTitle: string;
  channelName: string;
  channelId?: string;
  durationSec?: number;
}

export interface YoutubeContent {
  meta: YoutubeMetadata;
  transcript: TranscriptOutput;
}

/**
 * 動画ページを 1 度 fetch して、メタ情報 + 字幕の両方を返す。
 * 同じ動画について別々の API 呼び出しでメタと字幕を取りに行くと
 * subrequest を 2 倍消費する + レイテンシも 2 倍になるため、まとめる。
 */
export async function fetchYoutubeContent(videoId: string): Promise<YoutubeContent> {
  const html = await fetchWatchPage(videoId);
  const meta = extractMetadata(html);
  const transcript = await extractAndFetchTranscript(html);
  return { meta, transcript };
}

/** 字幕のみが要る procedure 用の薄いラッパ。 */
export async function fetchYoutubeTranscript(videoId: string): Promise<TranscriptOutput> {
  return (await fetchYoutubeContent(videoId)).transcript;
}

async function fetchWatchPage(videoId: string): Promise<string> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const res = await fetch(watchUrl, { headers: BROWSER_HEADERS });
  if (!res.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `youtube_page_unavailable: ${res.status}`,
    });
  }
  return res.text();
}

function extractMetadata(html: string): YoutubeMetadata {
  const idx = html.indexOf('"videoDetails":');
  if (idx === -1) {
    throw new TRPCError({ code: "NOT_FOUND", message: "video_meta_unavailable" });
  }

  const braceStart = html.indexOf("{", idx);
  if (braceStart === -1) {
    throw new TRPCError({ code: "NOT_FOUND", message: "video_meta_unavailable" });
  }

  const jsonStr = sliceBalancedObject(html, braceStart);
  if (!jsonStr) {
    throw new TRPCError({ code: "NOT_FOUND", message: "video_meta_unavailable" });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new TRPCError({ code: "NOT_FOUND", message: "video_meta_unavailable" });
  }

  const result = videoDetailsSchema.safeParse(parsed);
  if (!result.success) {
    throw new TRPCError({ code: "NOT_FOUND", message: "video_meta_unavailable" });
  }

  const durationSec = result.data.lengthSeconds ? Number(result.data.lengthSeconds) : undefined;

  return {
    videoTitle: result.data.title,
    channelName: result.data.author,
    channelId: result.data.channelId,
    durationSec: Number.isFinite(durationSec) ? durationSec : undefined,
  };
}

async function extractAndFetchTranscript(html: string): Promise<TranscriptOutput> {
  const tracksMatch = html.match(/"captionTracks":\s*(\[[^\]]*\])/);
  if (!tracksMatch?.[1]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "transcript_unavailable" });
  }

  let rawTracks: unknown;
  try {
    rawTracks = JSON.parse(tracksMatch[1]);
  } catch {
    throw new TRPCError({ code: "NOT_FOUND", message: "transcript_unavailable" });
  }

  const tracks = captionTracksSchema.safeParse(rawTracks);
  if (!tracks.success || tracks.data.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "transcript_unavailable" });
  }

  const picked =
    tracks.data.find((t) => t.languageCode === "ja") ??
    tracks.data.find((t) => t.languageCode === "en") ??
    tracks.data[0];

  if (!picked) {
    throw new TRPCError({ code: "NOT_FOUND", message: "transcript_unavailable" });
  }

  const captionRes = await fetch(picked.baseUrl, { headers: BROWSER_HEADERS });
  if (!captionRes.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `caption_fetch_failed: ${captionRes.status}`,
    });
  }

  const xml = await captionRes.text();
  const segments = parseCaptionXml(xml);
  if (segments.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message: "transcript_unavailable" });
  }

  const textLength = segments.reduce((acc, s) => acc + s.text.length, 0);

  return {
    language: picked.languageCode,
    segments,
    textLength,
  };
}

/**
 * <text start="0.5" dur="3.2">本文</text> 形式の YouTube 字幕 XML を最小コストでパース。
 * 属性の順序や引用符はだいたい固定だが、念のため start/dur/text を独立に拾う。
 */
function parseCaptionXml(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const attrs = m[1] ?? "";
    const body = m[2] ?? "";
    const start = Number(attrs.match(/\bstart="([\d.]+)"/)?.[1] ?? NaN);
    const dur = Number(attrs.match(/\bdur="([\d.]+)"/)?.[1] ?? NaN);
    if (!Number.isFinite(start) || !Number.isFinite(dur)) continue;

    const text = decodeXmlEntities(body).trim();
    if (text.length === 0) continue;

    segments.push({ start, dur, text });
  }
  return segments;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)));
}

/**
 * `s[start]` が `{` であることを前提に、対応する閉じ括弧までの部分文字列を返す。
 * JSON 文字列内のエスケープ済み `"` `\` を考慮する。
 * バランスが取れず終端まで読み切ったら null。
 */
function sliceBalancedObject(s: string, start: number): string | null {
  if (s[start] !== "{") return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}
