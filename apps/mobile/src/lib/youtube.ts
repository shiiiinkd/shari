/**
 * videoId から YouTube サムネイル URL を導出する（DB 列・レスポンスには持たせない）。
 *
 * mqdefault（320x180）を使う理由:
 *   - 真の 16:9。一覧行は 16:9 で見せたいので、4:3 で上下に黒帯が入る hqdefault より
 *     letterbox が出ず綺麗に収まる。
 *   - hqdefault と同じく全動画で確実に生成される（不安定なのは maxresdefault のみ）。
 */
export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}
