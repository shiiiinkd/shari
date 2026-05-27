/**
 * YouTube メタデータ (title / channel name) 取得サービス。
 *
 * 経緯:
 *   旧実装は watch ページ HTML を scrape して videoDetails + captionTracks を抜き、
 *   captionTracks の baseUrl から字幕 XML を fetch していた。2026 年に YouTube が
 *   PoT (Proof of Origin Token) 強制を入れて captionTracks 経由の字幕 fetch が
 *   全クライアントで動かなくなったため、字幕取得は Supadata 等の 3rd-party
 *   provider に逃がし、本サービスは「メタデータ取得」だけを担当する責務に縮小。
 *
 * 実装:
 *   oEmbed (https://www.youtube.com/oembed) を叩く。これは YouTube 公式の公開 API で
 *   PoT 要求がなく、Workers の fetch のみで動く。
 *   返るのは title / author_name のみ。channelId / durationSec は oEmbed では取れないが、
 *   videos テーブル側で NULL 許容なので未取得で良い。
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const oembedSchema = z.object({
  title: z.string().min(1),
  author_name: z.string().min(1),
});

export interface YoutubeMetadata {
  videoTitle: string;
  channelName: string;
  /** oEmbed では取得不可。将来 別 source で取れるようになったら埋める。 */
  channelId?: string;
  /** oEmbed では取得不可。同上。 */
  durationSec?: number;
}

export async function fetchYoutubeMetadata(videoId: string): Promise<YoutubeMetadata> {
  // oEmbed は GET のみ。format=json は明示する（デフォルトは XML）。
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(oembedUrl);

  if (res.status === 401 || res.status === 404) {
    // 非公開 / 限定公開 / 削除済 → 利用者に「動画が見つからない」と返したい
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "video_unavailable: 動画が見つからないか非公開です",
    });
  }
  if (!res.ok) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `youtube_oembed_failed: ${res.status}`,
    });
  }

  const json: unknown = await res.json();
  const parsed = oembedSchema.safeParse(json);
  if (!parsed.success) {
    // 動画が無い (404 で先に弾かれる) のではなく、oEmbed の仕様変更 / 一時障害で
    // 想定外の shape が返った状況。クライアントに「動画なし」と誤解させないため
    // upstream 異常として BAD_GATEWAY で扱う。
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "youtube_oembed_unexpected_shape",
    });
  }

  return {
    videoTitle: parsed.data.title,
    channelName: parsed.data.author_name,
  };
}
