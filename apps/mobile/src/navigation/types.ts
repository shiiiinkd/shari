/**
 * RootStack の route 定義。
 *
 * Result が受け取るのは videoId のみ。
 * 元 URL の表示は要約レスポンスのメタ（将来 summary.create に title を含める）で行う想定で、
 * route param には載せない（深いリンク URL 化したとき扱いが煩雑になるため）。
 */
export type RootStackParamList = {
  Home: undefined;
  Result: { videoId: string };
};
